import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HouseholdSettings } from "@/components/dashboard/HouseholdSettings";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Settings — GridFlex" };

export default async function SettingsPage() {
  if ((await getRole()) !== "participant") redirect("/dashboard");
  return <HouseholdSettings />;
}
