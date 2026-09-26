import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HouseholdDevices } from "@/components/dashboard/HouseholdDevices";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "My devices | GridFlex" };

export default async function DevicesPage() {
  if ((await getRole()) !== "participant") redirect("/dashboard");
  return <HouseholdDevices />;
}
