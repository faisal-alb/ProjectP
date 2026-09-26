import "server-only";
import { cookies } from "next/headers";
import {
  PROFILE_COOKIE,
  ROLE_COOKIE,
  defaultOperatorProfile,
  defaultParticipantProfile,
  parseOperatorProfile,
  parseParticipantProfile,
  type OperatorProfile,
  type ParticipantProfile,
  type Role,
} from "./profile";

export async function getRole(): Promise<Role | null> {
  const value = (await cookies()).get(ROLE_COOKIE)?.value;
  return value === "participant" || value === "operator" ? value : null;
}

async function readProfile(): Promise<unknown> {
  const raw = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function getParticipantProfile(): Promise<ParticipantProfile> {
  const raw = await readProfile();
  return raw === undefined ? defaultParticipantProfile : parseParticipantProfile(raw);
}

export async function getOperatorProfile(): Promise<OperatorProfile> {
  const raw = await readProfile();
  return raw === undefined ? defaultOperatorProfile : parseOperatorProfile(raw);
}
