// AES-256-GCM for secrets at rest in Redis. Node-only (not proxy.ts / Edge).
// Key derives from CREDENTIALS_SECRET (fallback SESSION_SECRET); rotating it
// invalidates existing ciphertexts.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const FORMAT_VERSION = "v1";

function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("CREDENTIALS_SECRET or SESSION_SECRET must be set to encrypt credentials");
  }
  return createHash("sha256").update(secret).digest();
}

/** Output: `v1:<b64 iv>:<b64 tag>:<b64 ciphertext>` */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Throws on tamper / wrong key / bad format. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Malformed encrypted secret");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
