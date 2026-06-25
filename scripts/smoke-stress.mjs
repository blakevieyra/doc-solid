#!/usr/bin/env node
/**
 * DocSolid smoke + stress test suite
 * Usage: node scripts/smoke-stress.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "https://docsolid.app";
const STRESS_CONCURRENCY = 25;
const STRESS_ROUNDS = 4;

const pages = [
  "/",
  "/signup",
  "/login",
  "/forgot-password",
  "/help",
  "/onboarding",
  "/documents",
  "/portal",
  "/profile",
  "/legal/terms",
  "/legal/privacy",
];

const results = { pass: 0, fail: 0, warn: 0, items: [] };

function log(status, name, detail = "") {
  const icon = status === "PASS" ? "✓" : status === "WARN" ? "!" : "✗";
  results.items.push({ status, name, detail });
  if (status === "PASS") results.pass++;
  else if (status === "WARN") results.warn++;
  else results.fail++;
  console.log(`${icon} [${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchStatus(path, opts = {}) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...opts });
  const ms = Math.round(performance.now() - start);
  return { status: res.status, ms, res };
}

async function smokePages() {
  console.log("\n=== SMOKE: Pages ===");
  for (const path of pages) {
    try {
      const { status, ms } = await fetchStatus(path);
      const expected = path === "/documents" || path === "/portal" || path === "/profile"
        ? [200, 307, 308]
        : [200];
      if (expected.includes(status)) log("PASS", `GET ${path}`, `${status} (${ms}ms)`);
      else if (status >= 300 && status < 400) log("WARN", `GET ${path}`, `redirect ${status}`);
      else log("FAIL", `GET ${path}`, `expected 200, got ${status}`);
    } catch (e) {
      log("FAIL", `GET ${path}`, e.message);
    }
  }
}

async function smokeApisUnauthed() {
  console.log("\n=== SMOKE: APIs (unauthenticated) ===");
  const cases = [
    { path: "/api/auth/session", expect: [401] },
    { path: "/api/profile", expect: [401] },
    { path: "/api/documents", expect: [401] },
  ];
  for (const { path, expect } of cases) {
    const { status, ms } = await fetchStatus(path);
    if (expect.includes(status)) log("PASS", `GET ${path}`, `${status} (${ms}ms)`);
    else log("FAIL", `GET ${path}`, `expected ${expect.join("|")}, got ${status}`);
  }
}

async function smokeAuthFlow() {
  console.log("\n=== SMOKE: Auth + profile + documents flow ===");
  const email = `smoke-${Date.now()}@docsolid-test.invalid`;
  const password = "SmokeTest123!";
  const name = "Smoke Tester";

  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const regBody = await reg.json();
  const cookie = reg.headers.get("set-cookie")?.split(";")[0] ?? "";

  if (reg.status === 200 && regBody.user?.id) {
    log("PASS", "POST /api/auth/register", `user ${regBody.user.id.slice(0, 8)}…`);
  } else {
    log("FAIL", "POST /api/auth/register", `${reg.status} ${JSON.stringify(regBody).slice(0, 120)}`);
    return null;
  }

  const sess = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookie },
  });
  const sessBody = await sess.json();
  if (sess.status === 200 && sessBody.session?.userId) {
    log("PASS", "GET /api/auth/session", `authenticated`);
  } else {
    log("FAIL", "GET /api/auth/session", `${sess.status}`);
    return cookie;
  }

  const profilePatch = {
    profileType: "business",
    onboardingComplete: false,
    business: { name: "Smoke Co", industry: "consulting", email },
    account: { email, displayName: name, accountId: regBody.user.id },
  };
  const profilePayload = {
    profile: {
      version: 1,
      profileType: "business",
      onboardingComplete: false,
      business: {
        name: "Smoke Co",
        tagline: "",
        industry: "consulting",
        email,
        phone: "",
        website: "",
        taxId: "",
        logo: null,
        address: { street: "", city: "", state: "", zip: "", country: "United States" },
      },
      personal: {
        fullName: name,
        title: "",
        email,
        phone: "",
        linkedin: "",
        address: { street: "", city: "", state: "", zip: "", country: "United States" },
      },
      organization: {
        name: "",
        mission: "",
        email: "",
        phone: "",
        website: "",
        taxId: "",
        logo: null,
        address: { street: "", city: "", state: "", zip: "", country: "United States" },
      },
      security: { pinEnabled: false, pinHash: null, encryptSensitive: true, lastUnlockedAt: null },
      subscription: { plan: "free", status: "none" },
      team: { enabled: false, orgName: "", members: [], shareBusinessProfile: true, shareOrganizationProfile: true },
      account: { email, displayName: name, accountId: regBody.user.id, timezone: "America/New_York" },
      preferences: {
        currency: "USD",
        dateFormat: "MDY",
        defaultPaymentTerms: "Net 30",
        emailNotifications: true,
        productUpdates: true,
        documentReminders: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  const profPut = await fetch(`${BASE}/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(profilePayload),
  });
  if (profPut.status === 200) log("PASS", "PUT /api/profile", "saved");
  else log("FAIL", "PUT /api/profile", `${profPut.status} ${(await profPut.text()).slice(0, 80)}`);

  const profGet = await fetch(`${BASE}/api/profile`, { headers: { Cookie: cookie } });
  const profGetBody = await profGet.json();
  if (profGet.status === 200 && profGetBody.profile?.business?.name === "Smoke Co") {
    log("PASS", "GET /api/profile", "round-trip OK");
  } else {
    log("FAIL", "GET /api/profile", `${profGet.status}`);
  }

  const accountId = profGetBody.profile?.account?.accountId ?? "";
  if (/^DS-/.test(accountId)) {
    log("PASS", "Profile account ID", accountId.slice(0, 20));
  } else {
    log("FAIL", "Profile account ID", accountId ? `invalid: ${accountId}` : "missing");
  }

  const forgotPw = await fetchStatus("/forgot-password");
  if (forgotPw.status === 200) log("PASS", "GET /forgot-password", `${forgotPw.status} (${forgotPw.ms}ms)`);
  else log("FAIL", "GET /forgot-password", `${forgotPw.status}`);

  const forgotApi = await fetch(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send", email: "nonexistent-smoke@test.invalid" }),
  });
  if (forgotApi.status === 200) log("PASS", "POST /api/auth/forgot-password", "200");
  else if (forgotApi.status === 503) log("WARN", "POST /api/auth/forgot-password", "503 — email not configured");
  else log("WARN", "POST /api/auth/forgot-password", `${forgotApi.status}`);

  const docPayload = {
    document: {
      localId: `smoke-doc-${Date.now()}`,
      title: "Smoke Test Invoice",
      templateId: "invoice",
      fieldData: { clientName: "Test Client" },
      status: "DRAFT",
      syncStatus: "SYNCED",
      domain: "business",
      category: "finance",
      documentNumber: "INV-SMOKE-001",
      userId: regBody.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  const docPost = await fetch(`${BASE}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(docPayload),
  });
  if (docPost.status === 200 || docPost.status === 201) {
    log("PASS", "POST /api/documents", "created");
  } else {
    log("FAIL", "POST /api/documents", `${docPost.status} ${(await docPost.text()).slice(0, 80)}`);
  }

  const docGet = await fetch(`${BASE}/api/documents`, { headers: { Cookie: cookie } });
  const docGetBody = await docGet.json();
  if (docGet.status === 200 && Array.isArray(docGetBody.documents) && docGetBody.documents.length >= 1) {
    log("PASS", "GET /api/documents", `${docGetBody.documents.length} doc(s)`);
  } else {
    log("FAIL", "GET /api/documents", `${docGet.status}`);
  }

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (login.status === 200) log("PASS", "POST /api/auth/login", "re-login OK");
  else log("FAIL", "POST /api/auth/login", `${login.status}`);

  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  if (logout.status === 200) log("PASS", "POST /api/auth/logout", "OK");
  else log("WARN", "POST /api/auth/logout", `${logout.status}`);

  return cookie;
}

async function smokeKvDependent() {
  console.log("\n=== SMOKE: KV-dependent endpoints ===");
  const support = await fetch(`${BASE}/api/support`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "smoke@test.invalid",
      subject: "Smoke test",
      message: "Automated smoke test message",
      category: "General question",
    }),
  });
  if (support.status === 200) log("PASS", "POST /api/support", "200");
  else if (support.status === 503) log("WARN", "POST /api/support", "503 — KV or email not configured");
  else if (support.status === 429) log("PASS", "POST /api/support", "429 rate limited (expected under load)");
  else log("FAIL", "POST /api/support", `${support.status}`);

  const invites = await fetch(`${BASE}/api/team/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invite@test.invalid" }),
  });
  if (invites.status === 401) log("PASS", "POST /api/team/invites", "401 without auth");
  else if (invites.status === 503) log("WARN", "POST /api/team/invites", "503 — KV not configured");
  else log("WARN", "POST /api/team/invites", `${invites.status}`);
}

async function stressEndpoint(name, fn, concurrency, rounds, acceptStatuses = null) {
  const times = [];
  let ok = 0;
  let fail = 0;
  let rateLimited = 0;

  for (let r = 0; r < rounds; r++) {
    const batch = Array.from({ length: concurrency }, () =>
      fn().then(({ status, ms }) => {
        times.push(ms);
        const accepted = acceptStatuses ? acceptStatuses.includes(status) : status >= 200 && status < 400;
        if (accepted) ok++;
        else if (status === 429) rateLimited++;
        else fail++;
        return status;
      }).catch(() => { fail++; times.push(9999); })
    );
    await Promise.all(batch);
  }

  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  const max = times[times.length - 1] ?? 0;
  const total = ok + fail + rateLimited;

  if (fail === 0) {
    log("PASS", `STRESS ${name}`, `${total} reqs — ok:${ok} 429:${rateLimited} p50:${p50}ms p95:${p95}ms max:${max}ms`);
  } else if (fail < total * 0.05) {
    log("WARN", `STRESS ${name}`, `${fail}/${total} failed — p95:${p95}ms`);
  } else {
    log("FAIL", `STRESS ${name}`, `${fail}/${total} failed — p95:${p95}ms`);
  }
}

async function stressTests() {
  console.log("\n=== STRESS: Concurrent load ===");
  await stressEndpoint(
    `GET / (${STRESS_CONCURRENCY}x${STRESS_ROUNDS})`,
    () => fetchStatus("/"),
    STRESS_CONCURRENCY,
    STRESS_ROUNDS
  );
  await stressEndpoint(
    `GET /api/auth/session (${STRESS_CONCURRENCY}x${STRESS_ROUNDS})`,
    () => fetchStatus("/api/auth/session"),
    STRESS_CONCURRENCY,
    STRESS_ROUNDS,
    [401]
  );
  await stressEndpoint(
    `POST /api/auth/register (${Math.min(10, STRESS_CONCURRENCY)}x2 unique)`,
    async () => {
      const email = `stress-${Date.now()}-${Math.random().toString(36).slice(2)}@test.invalid`;
      const start = performance.now();
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "StressTest123!", name: "Stress User" }),
      });
      return { status: res.status, ms: Math.round(performance.now() - start) };
    },
    10,
    2
  );
}

async function main() {
  console.log(`DocSolid smoke + stress test`);
  console.log(`Target: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    const health = await fetchStatus("/");
    if (health.status !== 200) {
      log("FAIL", "Site reachable", `homepage ${health.status}`);
    } else {
      log("PASS", "Site reachable", `${health.ms}ms`);
    }
  } catch (e) {
    log("FAIL", "Site reachable", e.message);
    process.exit(1);
  }

  await smokePages();
  await smokeApisUnauthed();
  await smokeAuthFlow();
  await smokeKvDependent();
  await stressTests();

  console.log("\n=== SUMMARY ===");
  console.log(`PASS: ${results.pass}  WARN: ${results.warn}  FAIL: ${results.fail}`);
  if (results.fail > 0) {
    console.log("\nFailed checks:");
    results.items.filter((i) => i.status === "FAIL").forEach((i) => console.log(`  - ${i.name}: ${i.detail}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
