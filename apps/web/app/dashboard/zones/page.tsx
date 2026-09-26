import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { forecastUpdatedAt, zones } from "@/lib/demo-data";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ZoneTable } from "@/components/dashboard/ZoneTable";
import { getRole } from "@/lib/session";

export const metadata: Metadata = { title: "Zones — GridFlex" };

export default async function ZonesPage() {
  if ((await getRole()) !== "operator") redirect("/dashboard");
  return (
    <div>
      <PageHeader title="Zones" subtitle={`Every zone tonight · Forecast updated ${forecastUpdatedAt}`} />
      <div className="mt-6">
        <ZoneTable zones={zones} />
      </div>
    </div>
  );
}
