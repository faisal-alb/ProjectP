import { household, type clearMarket, type FlexType } from "./demo-data";

/** The household shown on the Household dashboard. */
export const DEMO_HOUSEHOLD_RESOURCE_ID = "downtown-home-01";

export interface ParticipantCommitment {
  /** Stable id; hashed to the on-chain resource id. */
  resourceId: string;
  label: string;
  type: FlexType;
  kw: number;
  pricePerKwh: number;
  isDemoHousehold: boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Stable id of the i-th (0-based) managed household, e.g. downtown-home-01. */
export const homeResourceId = (i: number) => `downtown-home-${String(i + 1).padStart(2, "0")}`;

/** Display label of the i-th (0-based) managed household. */
export const homeLabel = (i: number) => `Home ${i + 1} (Downtown Austin home batteries)`;

/**
 * Turn cleared market rows into one commitment per paid participant. The
 * aggregated "Home batteries" offer becomes individual homes (each sharing up
 * to its battery's hourly limit), so every household is paid directly.
 */
export function participantCommitments(
  rows: ReturnType<typeof clearMarket>["rows"],
): ParticipantCommitment[] {
  return rows
    .filter((r) => r.acceptedKw > 0)
    .flatMap((r): ParticipantCommitment[] => {
      if (r.offer.type !== "Home batteries") {
        return [
          {
            resourceId: slug(r.offer.label),
            label: r.offer.label,
            type: r.offer.type,
            kw: r.acceptedKw,
            pricePerKwh: r.offer.pricePerKwh,
            isDemoHousehold: false,
          },
        ];
      }
      const homes = Math.max(1, Math.ceil(r.acceptedKw / household.maxDischargeKw));
      return Array.from({ length: homes }, (_, i) => {
        const resourceId = homeResourceId(i);
        const remaining = r.acceptedKw - i * household.maxDischargeKw;
        return {
          resourceId,
          label: homeLabel(i),
          type: r.offer.type,
          kw: Math.min(household.maxDischargeKw, remaining),
          pricePerKwh: r.offer.pricePerKwh,
          isDemoHousehold: resourceId === DEMO_HOUSEHOLD_RESOURCE_ID,
        };
      });
    });
}

/**
 * Simulated meter reading for the demo: the EV fleet over-delivers (and is
 * paid only what it committed), the solar group under-delivers (and is paid
 * only what it delivered), everyone else delivers exactly.
 */
export function simulatedDeliveredKw(p: Pick<ParticipantCommitment, "type" | "kw">): number {
  if (p.type === "EV charging") return p.kw + 10;
  if (p.type === "Solar export") return Math.max(0, p.kw - 10);
  return p.kw;
}
