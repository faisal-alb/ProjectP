import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardProviders } from "@/components/dashboard/DashboardProviders";
import { getOperatorProfile, getRole } from "@/lib/session";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const role = await getRole();
  if (!role) redirect("/onboarding");
  const label = role === "operator" ? (await getOperatorProfile()).orgName : "My energy";

  return (
    <DashboardProviders role={role}>
      <div className="flex flex-1 flex-col">
        <DashboardHeader role={role} label={label} />
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </DashboardProviders>
  );
}
