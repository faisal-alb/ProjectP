// Integer units shared with the on-chain program. Keep these in lockstep with
// programs/gridflex: energy in Wh, USDC in base units (6 decimals), prices in
// USDC base units per kWh. All payout math floors, exactly like the program.

export const USDC_DECIMALS = 6;
const USDC_SCALE = 10 ** USDC_DECIMALS;

/** Dollars (e.g. 94.7) to USDC base units. */
export function usdToBase(usd: number): bigint {
  return BigInt(Math.round(usd * USDC_SCALE));
}

/** USDC base units to dollars, for display only. */
export function baseToUsd(base: bigint): number {
  return Number(base) / USDC_SCALE;
}

/** $/kWh to USDC base units per kWh (e.g. 0.14 → 140_000n). */
export function priceToBasePerKwh(usdPerKwh: number): bigint {
  return usdToBase(usdPerKwh);
}

/** Power held for a duration, as watt-hours (e.g. 800 kW for 1 h → 800_000n). */
export function kwToWh(kw: number, hours = 1): bigint {
  return BigInt(Math.round(kw * 1000 * hours));
}

/** What a delivery of `wh` pays at `pricePerKwh` (base units). Floors, like the program. */
export function payoutBase(wh: bigint, pricePerKwh: bigint): bigint {
  return (wh * pricePerKwh) / 1000n;
}

/** Minimum escrow for a market: the whole need at the price cap. */
export function minEscrowBase(requiredWh: bigint, maxPricePerKwh: bigint): bigint {
  return payoutBase(requiredWh, maxPricePerKwh);
}

export function formatUsdc(base: bigint): string {
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const whole = abs / BigInt(USDC_SCALE);
  const cents = (abs % BigInt(USDC_SCALE)) / 10_000n;
  return `${negative ? "-" : ""}$${whole.toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
}
