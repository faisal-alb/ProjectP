import type { Metadata } from "next";
import { resolveZip } from "@gridflex/shared";
import { HouseholdView } from "@/components/dashboard/HouseholdView";
import { OperatorDashboard } from "@/components/dashboard/OperatorDashboard";
import { getOperatorProfile, getParticipantProfile, getRole } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRole()) === "operator" ? "Grid overview — GridFlex" : "My energy — GridFlex" };
}

/** One dashboard per account: the role is chosen at onboarding, not toggled here. */
export default async function DashboardPage() {
  if ((await getRole()) === "operator") {
    const profile = await getOperatorProfile();
    return <OperatorDashboard initialCap={profile.maxNormalPrice} />;
  }
  const profile = await getParticipantProfile();
  const location = resolveZip(profile.zip);
  return <HouseholdView zone={location?.zone ?? "Downtown Miami"} feeder={location?.feeder ?? "DT-A"} profile={profile} />;
}
