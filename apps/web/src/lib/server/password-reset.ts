import crypto from "crypto";
import { prisma } from "@doc-solid/database";
import { isEmailConfigured } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/sendgrid";
import { passwordResetCodeEmail } from "@/lib/email/templates";
import { kvGet, kvSet } from "./kv";
import { hashPassword } from "./password";
import { deleteAllUserSessions } from "./session";
import { isProduction } from "./env";

const CODE_TTL_SEC = 15 * 60;
const TOKEN_TTL_SEC = 30 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function codeKey(email: string) {
  return `pwd-reset:code:${email}`;
}

function tokenKey(email: string) {
  return `pwd-reset:token:${email}`;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function sendPasswordResetCode(
  email: string
): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash) {
    // Do not reveal whether account exists
    return { ok: true };
  }

  if (!isEmailConfigured()) {
    if (!isProduction()) {
      const code = generateCode();
      await kvSet(codeKey(normalized), code, CODE_TTL_SEC);
      return { ok: true, devCode: code };
    }
    return { ok: false, error: "Password reset email is not configured. Contact support." };
  }

  const code = generateCode();
  await kvSet(codeKey(normalized), code, CODE_TTL_SEC);

  const mail = passwordResetCodeEmail(code);
  const sent = await sendEmail({
    to: normalized,
    subject: mail.subject,
    html: mail.html,
  });

  if (!sent) {
    return { ok: false, error: "Could not send reset code. Try again in a few minutes." };
  }

  return { ok: true };
}

export async function confirmPasswordResetCode(
  email: string,
  code: string
): Promise<{ ok: boolean; resetToken?: string; error?: string }> {
  const normalized = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Invalid email" };
  }
  if (!/^\d{6}$/.test(trimmedCode)) {
    return { ok: false, error: "Enter the 6-digit code" };
  }

  const stored = await kvGet(codeKey(normalized));
  if (!stored) {
    return { ok: false, error: "Reset code expired. Request a new one." };
  }

  if (!isEmailConfigured() && isProduction()) {
    return { ok: false, error: "Password reset is unavailable" };
  }

  if (stored !== trimmedCode) {
    return { ok: false, error: "Incorrect reset code" };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash) {
    return { ok: false, error: "Account not found" };
  }

  const resetToken = generateToken();
  await kvSet(tokenKey(normalized), resetToken, TOKEN_TTL_SEC);
  await kvSet(codeKey(normalized), "", 1);

  return { ok: true, resetToken };
}

export async function resetPasswordWithToken(
  email: string,
  token: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = email.trim().toLowerCase();
  const trimmedToken = token.trim();

  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Invalid email address" };
  }
  if (!trimmedToken) {
    return { ok: false, error: "Reset session expired. Start again." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const storedToken = await kvGet(tokenKey(normalized));
  if (!storedToken || storedToken !== trimmedToken) {
    return { ok: false, error: "Reset session expired. Request a new code." };
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash) {
    return { ok: false, error: "Account not found" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await kvSet(tokenKey(normalized), "", 1);
  await deleteAllUserSessions(user.id);

  return { ok: true };
}
