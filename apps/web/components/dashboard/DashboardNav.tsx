"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/profile";

const TABS: Record<Role, { href: string; label: string }[]> = {
  participant: [
    { href: "/dashboard", label: "Tonight" },
    { href: "/dashboard/devices", label: "Devices" },
    { href: "/dashboard/earnings", label: "Earnings" },
    { href: "/dashboard/settings", label: "Settings" },
  ],
  operator: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/zones", label: "Zones" },
  ],
};

export function DashboardNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mb-px flex gap-5 overflow-x-auto">
      {TABS[role].map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 py-2.5 text-sm transition-colors ${
              active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
