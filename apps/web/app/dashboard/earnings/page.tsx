import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HouseholdEarnings } from "@/components/dashboard/HouseholdEarnings";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Earnings | GridFlex" };

export default async function EarningsPage() {
  if ((await getRole()) !== "participant") redirect("/dashboard");
  return <HouseholdEarnings />;
}
