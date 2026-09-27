"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, authReady } from "@/lib/auth";
import { getParticipantProfile, getRole, getSession } from "@/lib/session";
import {
  PROFILE_COOKIE,
  ROLE_COOKIE,
  parseOperatorProfile,
  parseParticipantProfile,
  type Role,
} from "@/lib/profile";

const cookieOptions = { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 } as const;

/**
 * Finish onboarding: remember the account type and its settings. Placeholder
 * for real signup, but the shape (a role plus a validated profile) is what the
 * real thing will store.
 */
export async function completeOnboarding(role: Role, input: unknown) {
  const profile = role === "operator" ? parseOperatorProfile(input) : parseParticipantProfile(input);
  await authReady;
  if (!(await getSession())) await auth.api.signInAnonymous({ headers: await headers() });
  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, cookieOptions);
  jar.set(PROFILE_COOKIE, JSON.stringify(profile), cookieOptions);
  return { ok: true as const };
}

/**
 * Save the AutoFlex limits from Settings, so they survive a reload and match what the
 * household chose in onboarding. Only the limits change; devices and location stay as they were.
 */
export async function saveParticipantLimits(input: unknown) {
  if ((await getRole()) !== "participant") return { ok: false as const };
  const p = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const current = await getParticipantProfile();
  const next = parseParticipantProfile({
    ...current,
    autoFlex: p.autoFlex,
    reservePercent: p.reserve,
    maxKwhPerEvent: p.maxKwh,
    maxEventsPerDay: p.maxEvents,
    minRate: p.minRate,
    emergency: p.emergency,
    ev: p.ev,
    hvac: p.hvac,
  });
  (await cookies()).set(PROFILE_COOKIE, JSON.stringify(next), cookieOptions);
  return { ok: true as const };
}

export async function signOut() {
  await authReady;
  await auth.api.signOut({ headers: await headers() });
  const jar = await cookies();
  jar.delete(ROLE_COOKIE);
  jar.delete(PROFILE_COOKIE);
  redirect("/onboarding");
}
