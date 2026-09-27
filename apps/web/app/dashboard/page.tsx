import type { Metadata } from "next";
import { HouseholdView } from "@/components/dashboard/HouseholdView";
import { OperatorDashboard } from "@/components/dashboard/OperatorDashboard";
import { getOperatorProfile, getRole } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRole()) === "operator" ? "Grid overview | GridFlex" : "My energy | GridFlex" };
}

/** One dashboard per account: the role is chosen at onboarding, not toggled here. */
export default async function DashboardPage() {
  if ((await getRole()) === "operator") {
    const profile = await getOperatorProfile();
    return <OperatorDashboard initialCap={profile.maxNormalPrice} />;
  }
  return <HouseholdView />;
}
