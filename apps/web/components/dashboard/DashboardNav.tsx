"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/profile";

const TABS: Record<Role, { href: string; label: string }[]> = {
  participant: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/devices", label: "Devices" },
    { href: "/dashboard/earnings", label: "Earnings" },
    { href: "/dashboard/settings", label: "Settings" },
  ],
  operator: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/zones", label: "Zones" },
  ],
};

/**
 * One indicator for the whole nav that slides to the current tab, so moving between pages reads
 * as moving along the same strip. It's placed with transforms only, lands without motion on first
 * paint, and CSS eases it from wherever it is if you switch again mid-slide.
 */
export function DashboardNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const bar = barRef.current;
    if (!nav || !bar) return;
    const place = () => {
      const tab = nav.querySelector<HTMLElement>('[aria-current="page"]');
      bar.style.opacity = tab ? "1" : "0";
      if (tab) bar.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
    };
    place();
    // Only glide after the first placement, and keep it right as the font loads or the nav resizes.
    const frame = requestAnimationFrame(() => (bar.dataset.ready = "true"));
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Dashboard" className="relative -mb-px flex gap-5 overflow-x-auto">
      {TABS[role].map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 py-2.5 text-sm font-medium transition-colors duration-200 ${
              active ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
      <span ref={barRef} className="nav-indicator" aria-hidden="true" />
    </nav>
  );
}
