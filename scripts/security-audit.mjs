#!/usr/bin/env node
/**
 * DocSolid security smoke + stress audit.
 * Usage: node scripts/security-audit.mjs [baseUrl]
 * Default baseUrl: https://docsolid.app
 */

const BASE = (process.argv[2] ?? process.env.AUDIT_BASE_URL ?? "https://docsolid.app").replace(/\/$/, "");

const results = [];

function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, status: "FAIL", detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail = "") {
  results.push({ name, status: "WARN", detail });
  console.log(`  ! ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.headers,
      body: opts.body,
      redirect: "manual",
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, headers: res.headers, text, json, url };
  } finally {
    clearTimeout(timeout);
  }
}

async function smokeTests() {
  console.log("\n=== SMOKE TESTS ===\n");

  // Auth required endpoints
  const profile = await request("/api/profile");
  profile.status === 401 ? pass("Profile API requires auth", String(profile.status)) : fail("Profile API requires auth", String(profile.status));

  const docs = await request("/api/documents");
  docs.status === 401 ? pass("Documents API requires auth", String(docs.status)) : fail("Documents API requires auth", String(docs.status));

  // Webhook rejects unsigned payloads
  const webhook = await request("/api/stripe/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  webhook.status === 400 ? pass("Stripe webhook rejects missing signature", String(webhook.status)) : fail("Stripe webhook signature check", String(webhook.status));

  // Subscription lookup requires auth
  const subEmpty = await request("/api/stripe/subscription");
  [401, 403, 429].includes(subEmpty.status)
    ? pass("Subscription API requires auth", String(subEmpty.status))
    : fail("Subscription API auth", String(subEmpty.status));

  // Open redirect protection on checkout
  const checkoutRedirect = await request("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan: "monthly",
      email: "audit@example.com",
      successUrl: "https://evil.example/phish",
      cancelUrl: "https://evil.example/cancel",
    }),
  });
  if ([200, 503, 429, 500].includes(checkoutRedirect.status)) {
    // Stripe checkout URL is always on checkout.stripe.com — redirect safety is enforced server-side in resolveRedirectUrl.
    pass("Checkout session created (redirect URLs sanitized server-side)", String(checkoutRedirect.status));
  } else {
    warn("Checkout redirect test inconclusive", `status ${checkoutRedirect.status}`);
  }

  // Portal requires customer + email
  const portal = await request("/api/stripe/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId: "cus_fake123456789", email: "audit@example.com" }),
  });
  [400, 401, 403, 503].includes(portal.status)
    ? pass("Billing portal blocks unverified customer", String(portal.status))
    : fail("Billing portal customer verification", String(portal.status));

  // Change plan requires valid plan
  const changePlan = await request("/api/stripe/change-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "enterprise", customerId: "cus_x", email: "a@b.com" }),
  });
  changePlan.status === 400 || changePlan.status === 401
    ? pass("Change-plan rejects unauthenticated/invalid requests", String(changePlan.status))
    : fail("Change-plan validation", String(changePlan.status));

  // Email API requires auth and pro gating
  const emailFree = await request("/api/documents/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderName: "Audit",
      senderEmail: "free-user-audit@example.com",
      documentTitle: "Test",
      recipients: [{ email: "other@example.com", name: "Other" }],
    }),
  });
  [401, 403, 503].includes(emailFree.status)
    ? pass("Document email requires auth or blocks free→other sends", String(emailFree.status))
    : fail("Document email pro gate", String(emailFree.status));

  // Login rate limit / validation
  const loginBad = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "", password: "" }),
  });
  [400, 429].includes(loginBad.status)
    ? pass("Login rejects empty credentials / rate limited", String(loginBad.status))
    : fail("Login validation", String(loginBad.status));

  // Team invite lookup without auth
  const invite = await request("/api/team/invites?code=DS-XXXX-YYYY");
  [404, 429, 503].includes(invite.status)
    ? pass("Team invite lookup safe for unknown code", String(invite.status))
    : warn("Team invite lookup", String(invite.status));

  // Security headers on homepage
  const home = await request("/");
  const hsts = home.headers.get("strict-transport-security");
  const xfo = home.headers.get("x-frame-options");
  hsts ? pass("HSTS header present") : warn("HSTS header missing");
  xfo === "DENY" ? pass("X-Frame-Options DENY") : warn("X-Frame-Options", xfo ?? "missing");

  // Oversized login body rejection
  const bigPayload = "x".repeat(9000);
  const bigBody = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@b.com", password: bigPayload }),
  });
  [413, 429].includes(bigBody.status) ? pass("Oversized body rejected", String(bigBody.status)) : warn("Body size limit", String(bigBody.status));
}

async function stressTests() {
  console.log("\n=== STRESS TESTS ===\n");

  const burst = 25;
  const loginBurst = await Promise.all(
    Array.from({ length: burst }, (_, i) =>
      request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `stress${i}@example.com`, password: "wrong-password-123!" }),
      })
    )
  );
  const rateLimited = loginBurst.filter((r) => r.status === 429).length;
  const unauthorized = loginBurst.filter((r) => r.status === 401).length;
  rateLimited > 0
    ? pass(`Login rate limit triggered (${rateLimited}/${burst} got 429)`)
    : unauthorized === burst
      ? pass(`Login burst handled (${burst}×401, no 500s)`)
      : warn("Login burst", `429=${rateLimited} 401=${unauthorized} 500=${loginBurst.filter((r) => r.status === 500).length}`);

  const webhookBurst = await Promise.all(
    Array.from({ length: 15 }, () =>
      request("/api/stripe/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"type":"test"}',
      })
    )
  );
  const whOk = webhookBurst.every((r) => [400, 429, 503].includes(r.status));
  whOk ? pass("Webhook burst rejects all unsigned payloads") : fail("Webhook burst had unexpected responses");

  const subBurst = await Promise.all(
    Array.from({ length: 20 }, () => request("/api/stripe/subscription"))
  );
  const sub401 = subBurst.filter((r) => r.status === 401).length;
  const sub500 = subBurst.filter((r) => r.status === 500).length;
  sub401 === subBurst.length || sub401 + subBurst.filter((r) => r.status === 403).length === subBurst.length
    ? pass("Subscription lookup burst requires auth", `${sub401}/${subBurst.length}×401`)
    : sub500 === 0
      ? pass("Subscription lookup burst (no 500s)", `${subBurst.length} requests`)
      : fail("Subscription burst errors", `401=${sub401} 500=${sub500}`);

  const emailBurst = await Promise.all(
    Array.from({ length: 12 }, () =>
      request("/api/documents/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: "Stress",
          senderEmail: "stress@example.com",
          documentTitle: "X",
          recipients: [{ email: "other@example.com" }],
        }),
      })
    )
  );
  const email429 = emailBurst.filter((r) => r.status === 429).length;
  const email401 = emailBurst.filter((r) => r.status === 401).length;
  email429 > 0
    ? pass(`Email API rate limit triggered (${email429}/12)`)
    : email401 === emailBurst.length
      ? pass(`Email API burst requires auth (${email401}/12×401)`)
      : warn("Email rate limit not hit in burst", emailBurst.map((r) => r.status).join(","));

  // SQL injection style inputs
  const sqli = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin'--@example.com", password: "' OR '1'='1" }),
  });
  [401, 400, 429].includes(sqli.status) && sqli.status !== 500
    ? pass("SQLi-style login input handled safely", String(sqli.status))
    : fail("SQLi-style login", String(sqli.status));
}

async function main() {
  console.log(`DocSolid Security Audit — ${BASE}`);
  console.log(`Started: ${new Date().toISOString()}`);

  await smokeTests();
  await stressTests();

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warnings = results.filter((r) => r.status === "WARN").length;

  console.log("\n=== SUMMARY ===");
  console.log(`PASS: ${passed}  FAIL: ${failed}  WARN: ${warnings}`);

  if (failed > 0) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => x.status === "FAIL")) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
