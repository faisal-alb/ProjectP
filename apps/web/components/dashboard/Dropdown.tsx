"use client";

import { useEffect, useId, useRef, useState } from "react";

/** A button that toggles a small panel below it; closes on outside click or Escape. */
export function Dropdown({
  trigger,
  label,
  children,
  align = "right",
  width = "w-72",
}: {
  trigger: React.ReactNode;
  label: string;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition-[color,border-color,transform] hover:border-border-strong active:scale-[0.97] aria-expanded:border-border-strong"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          className={`pop-in absolute top-full z-50 mt-2 ${width} max-w-[calc(100vw-2.5rem)] rounded-md border border-border-strong bg-background-raised p-4 ${
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
