import { redirect } from "next/navigation";
import { resolveZip } from "@gridflex/shared";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardProviders } from "@/components/dashboard/DashboardProviders";
import { getOperatorProfile, getParticipantProfile, getRole } from "@/lib/session";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const role = await getRole();
  if (!role) redirect("/onboarding");

  let label = "My energy";
  let household;
  if (role === "operator") {
    label = (await getOperatorProfile()).orgName;
  } else {
    const profile = await getParticipantProfile();
    const location = resolveZip(profile.zip);
    household = { zone: location?.zone ?? "Downtown Austin", feeder: location?.feeder ?? "DT-A", profile };
  }

  return (
    <DashboardProviders role={role} household={household}>
      <div className="dash flex flex-1 flex-col">
        <DashboardHeader role={role} label={label} />
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </DashboardProviders>
  );
}
