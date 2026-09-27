import { RunDashboard } from "@/components/dashboard/RunDashboard";
import { getRole } from "@/lib/session";
export default async function Page() {
  const role = await getRole();
  return <RunDashboard role={role === "operator" ? "operator" : "participant"} view="earnings" />;
}
