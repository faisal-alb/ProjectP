import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeDevices } from "@/components/dashboard/HomeDashboard";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "My devices | GridFlex" };

export default async function Page() {
  if ((await getRole()) !== "participant") redirect("/dashboard");
  return <HomeDevices />;
}
