"use client";

import { useState } from "react";
import type { Zone } from "@/lib/demo-data";
import { ZoneTable } from "./ZoneTable";
import { ZonesMap } from "./ZonesMap";

/** Map beside a zone sidebar that widens when expanded. Stacks on phones and tablets. */
export function ZonesView({ zones }: { zones: Zone[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <ZonesMap zones={zones} />
      </div>
      <aside className={`shrink-0 lg:sticky lg:top-32 ${expanded ? "lg:w-[640px]" : "lg:w-80"}`}>
        <ZoneTable zones={zones} expanded={expanded} onExpandedChange={setExpanded} />
      </aside>
    </div>
  );
}
