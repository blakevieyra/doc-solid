const STORAGE_KEY = "doc-solid-profile-v1";
const LEGACY_KEY = "doc-solid-profile";

/** Simple SHA-256 hash for PIN verification (not for server auth) */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + ":doc-solid:salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}

interface EncryptedPayload {
  iv: string;
  data: string;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptValue(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new TextEncoder().encode(plaintext)
  );
  const payload: EncryptedPayload & { salt: string } = {
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
  return `enc:${JSON.stringify(payload)}`;
}

export async function decryptValue(ciphertext: string, passphrase: string): Promise<string> {
  if (!ciphertext.startsWith("enc:")) return ciphertext;
  const payload = JSON.parse(ciphertext.slice(4)) as EncryptedPayload & { salt: string };
  const salt = Uint8Array.from(atob(payload.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, data);
  return new TextDecoder().decode(decrypted);
}

export function isEncrypted(value: string): boolean {
  return value.startsWith("enc:");
}

export function getStorageKey(): string {
  return STORAGE_KEY;
}

export function getLegacyKey(): string {
  return LEGACY_KEY;
}

/** Validate logo file before storing */
export function validateLogoFile(file: File): { ok: true } | { ok: false; error: string } {
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Logo must be PNG, JPG, WebP, or SVG" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo must be under 2 MB" };
  }
  return { ok: true };
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const LOGO_MAX_DIMENSION = 800;
const LOGO_JPEG_QUALITY = 0.88;
/** Keep encoded logos small enough for profile sync (~512KB+ API headroom). */
const LOGO_MAX_DATA_URL_CHARS = 380_000;

/** Resize and compress raster logos; pass SVG through when small enough. */
export async function prepareLogoForStorage(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    const dataUrl = await fileToDataUrl(file);
    if (dataUrl.length > LOGO_MAX_DATA_URL_CHARS) {
      throw new Error("SVG logo is too large — simplify the file or use PNG/JPG under 2 MB");
    }
    return dataUrl;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process logo image");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const preferPng = file.type === "image/png" || file.type === "image/webp";
  let dataUrl = preferPng
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", LOGO_JPEG_QUALITY);

  if (dataUrl.length > LOGO_MAX_DATA_URL_CHARS && preferPng) {
    dataUrl = canvas.toDataURL("image/jpeg", LOGO_JPEG_QUALITY);
  }

  if (dataUrl.length > LOGO_MAX_DATA_URL_CHARS) {
    throw new Error("Logo is still too large after compression — try a smaller image");
  }

  return dataUrl;
}

export function sanitizeImportData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const dangerous = ["__proto__", "constructor", "prototype"];
  for (const key of Object.keys(obj)) {
    if (dangerous.includes(key)) return null;
  }
  return obj;
}
