/** 32-byte on-chain identifier for an off-chain id (zone, resource, proof payload). */
export async function hash32(value: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}
