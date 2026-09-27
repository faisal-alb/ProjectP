import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RunDashboard } from "@/components/dashboard/RunDashboard";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Zones | GridFlex" };

export default async function Page() {
  if ((await getRole()) !== "operator") redirect("/dashboard");
  return <RunDashboard role="operator" view="zones" />;
}
