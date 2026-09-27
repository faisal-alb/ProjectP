import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeRules } from "@/components/dashboard/HomeDashboard";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Your rules | GridFlex" };

export default async function Page() {
  if ((await getRole()) !== "participant") redirect("/dashboard");
  return <HomeRules />;
}
