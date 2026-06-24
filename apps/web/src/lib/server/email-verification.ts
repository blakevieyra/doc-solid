import crypto from "crypto";
import { prisma } from "@doc-solid/database";
import { isEmailConfigured } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/sendgrid";
import { emailVerificationCodeEmail } from "@/lib/email/templates";
import { kvGet, kvSet } from "./kv";

const CODE_TTL_SEC = 15 * 60;
const TOKEN_TTL_SEC = 30 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function codeKey(email: string) {
  return `email-verify:code:${email}`;
}

function tokenKey(email: string) {
  return `email-verify:token:${email}`;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function isEmailVerificationRequired(): boolean {
  return isEmailConfigured();
}

export async function sendSignupVerificationCode(
  email: string
): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  if (!isEmailVerificationRequired()) {
    const token = generateToken();
    const code = generateCode();
    await kvSet(tokenKey(normalized), token, TOKEN_TTL_SEC);
    await kvSet(codeKey(normalized), code, CODE_TTL_SEC);
    return { ok: true, devCode: code };
  }

  const code = generateCode();
  await kvSet(codeKey(normalized), code, CODE_TTL_SEC);

  const mail = emailVerificationCodeEmail(code);
  const sent = await sendEmail({
    to: normalized,
    subject: mail.subject,
    html: mail.html,
  });

  if (!sent) {
    return { ok: false, error: "Could not send verification email. Try again in a few minutes." };
  }

  return { ok: true };
}

export async function confirmSignupVerificationCode(
  email: string,
  code: string
): Promise<{ ok: boolean; signupToken?: string; error?: string }> {
  const normalized = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Invalid email" };
  }

  const stored = await kvGet(codeKey(normalized));
  if (!stored) {
    return { ok: false, error: "Verification code expired. Request a new one." };
  }

  if (!isEmailVerificationRequired()) {
    if (stored !== trimmedCode) {
      return { ok: false, error: "Incorrect verification code" };
    }
  } else if (stored !== trimmedCode) {
    return { ok: false, error: "Incorrect verification code" };
  }

  const signupToken = generateToken();
  await kvSet(tokenKey(normalized), signupToken, TOKEN_TTL_SEC);
  return { ok: true, signupToken };
}

export async function consumeSignupToken(email: string, signupToken: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const stored = await kvGet(tokenKey(normalized));
  if (!stored || stored !== signupToken) return false;
  await kvSet(tokenKey(normalized), "", 1);
  await kvSet(codeKey(normalized), "", 1);
  return true;
}
