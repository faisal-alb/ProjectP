import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeEarnings } from "@/components/dashboard/HomeDashboard";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Earnings | GridFlex" };

export default async function Page() {
  if ((await getRole()) !== "participant") redirect("/dashboard");
  return <HomeEarnings />;
}
