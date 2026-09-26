// Wallets GridFlex holds on behalf of participants who shouldn't need to
// manage keys (households, and the other demo resources). Payouts only need
// the address; the seed is kept encrypted for a future "withdraw" feature.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createKeyPairSignerFromPrivateKeyBytes, type Address, type KeyPairSigner } from "@solana/kit";

import { cluster, config } from "./env";

interface StoredWallet {
  address: Address;
  /** base64(iv | tag | ciphertext) of the 32-byte ed25519 seed. */
  seed: string;
}

const file = path.join(config.dataDir, `wallets.${cluster}.json`);
const wallets: Record<string, StoredWallet> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};

function persist() {
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(file, JSON.stringify(wallets, null, 2), { mode: 0o600 });
}

function encrypt(seed: Uint8Array): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(seed), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

function decrypt(value: string): Uint8Array {
  const raw = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", config.encryptionKey, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return new Uint8Array(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]));
}

/** The managed wallet address for a resource, created on first use. */
export async function managedWallet(resourceId: string): Promise<Address> {
  const existing = wallets[resourceId];
  if (existing) return existing.address;
  const seed = new Uint8Array(randomBytes(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  wallets[resourceId] = { address: signer.address, seed: encrypt(seed) };
  persist();
  return signer.address;
}

/** The signer for a managed wallet (not used by v1 flows, which only pay in). */
export async function managedSigner(resourceId: string): Promise<KeyPairSigner> {
  const stored = wallets[resourceId];
  if (!stored) throw new Error(`No managed wallet for ${resourceId}`);
  return createKeyPairSignerFromPrivateKeyBytes(decrypt(stored.seed));
}
