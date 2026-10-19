import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Generates a secure salted scrypt hash for storing user passwords.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;

  if (!storedHash.startsWith("scrypt:")) {
    // Fallback for plain comparison in legacy/mock entries
    return password === storedHash;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;

  const [, salt, keyHex] = parts;
  const keyBuffer = Buffer.from(keyHex, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);

  if (keyBuffer.length !== derivedBuffer.length) return false;
  return timingSafeEqual(keyBuffer, derivedBuffer);
}
