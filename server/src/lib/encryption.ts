/**
 * AES-256-GCM Encryption Utilities
 * 
 * 📁 server/src/lib/encryption.ts
 * Purpose: Encrypt/decrypt API keys stored in the database
 * Depends on: Node.js crypto module, ENCRYPTION_KEY env var
 * Used by: services/ai-proxy.ts, adapters/*
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Must be exactly 32 bytes (256 bits) hex-encoded (64 hex chars).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('[Encryption] ENCRYPTION_KEY environment variable is required');
  }
  if (key.length !== 64) {
    throw new Error('[Encryption] ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string containing IV + ciphertext + auth tag.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const tag = cipher.getAuthTag();

  // Format: IV (16 bytes) + Tag (16 bytes) + Ciphertext
  const result = Buffer.concat([iv, tag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt a base64 string encrypted with encrypt().
 * Throws if the data has been tampered with (GCM auth tag check).
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedBase64, 'base64');

  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('[Encryption] Invalid encrypted data: too short');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a new random encryption key (for initial setup).
 * Run once: `node -e "require('./encryption').generateKey()"`
 */
export function generateKey(): string {
  const key = randomBytes(32).toString('hex');
  console.log(`Generated encryption key: ${key}`);
  console.log('Add to your .env: ENCRYPTION_KEY=' + key);
  return key;
}
