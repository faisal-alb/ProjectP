import type { Metadata } from "next";
import { HomeOverview } from "@/components/dashboard/HomeDashboard";
import { RunDashboard } from "@/components/dashboard/RunDashboard";
import { getRole } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getRole()) === "operator" ? "Grid overview | GridFlex" : "My energy | GridFlex" };
}

export default async function Page() {
  if ((await getRole()) === "operator") return <RunDashboard role="operator" view="overview" />;
  return <HomeOverview />;
}
