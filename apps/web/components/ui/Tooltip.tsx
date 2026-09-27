"use client";

import { cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

type Side = "top" | "bottom";

const GAP = 8;
const MARGIN = 8;

/**
 * A small explanatory popover for a control or a term. Opens on hover (after a short delay), on keyboard
 * focus, and on tap. Stays open while the pointer is over it; Escape, an outside tap, scrolling or
 * resizing close it. Rendered in a portal, so tables and scroll containers never clip it.
 *
 * `children` must be one focusable element (or one that gets `tabIndex={0}`); it receives `aria-describedby`.
 */
export function Tooltip({
  content,
  side = "top",
  children,
}: {
  content: React.ReactNode;
  side?: Side;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef(0);

  const clear = () => window.clearTimeout(timer.current);
  const show = (delay: number) => {
    clear();
    if (delay === 0) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = (delay = 100) => {
    clear();
    if (delay === 0) setOpen(false);
    else timer.current = window.setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !tipRef.current?.contains(target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Positions the popover as it mounts: centred on the trigger, flipped if there's no room, clamped to the viewport.
  const place = useCallback(
    (el: HTMLDivElement | null) => {
      tipRef.current = el;
      const trigger = triggerRef.current;
      if (!el || !trigger) return;
      const t = trigger.getBoundingClientRect();
      const p = el.getBoundingClientRect();
      let s: Side = side;
      if (s === "top" && t.top - p.height - GAP < MARGIN) s = "bottom";
      else if (s === "bottom" && t.bottom + p.height + GAP > window.innerHeight - MARGIN) s = "top";
      const top = s === "top" ? t.top - p.height - GAP : t.bottom + GAP;
      const left = Math.min(Math.max(MARGIN, t.left + t.width / 2 - p.width / 2), window.innerWidth - p.width - MARGIN);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.transformOrigin = s === "top" ? "bottom center" : "top center";
      el.style.visibility = "visible";
    },
    [side],
  );

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType !== "touch" && show(350)}
      onPointerLeave={(e) => e.pointerType !== "touch" && hide()}
      onFocus={() => show(0)}
      onBlur={() => hide(0)}
      onClick={() => show(0)}
    >
      {cloneElement(children, { "aria-describedby": open ? id : undefined })}
      {open &&
        createPortal(
          <div
            ref={place}
            id={id}
            role="tooltip"
            onPointerEnter={clear}
            onPointerLeave={() => hide()}
            style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
            className="pop-in z-[60] w-max max-w-64 rounded-md border border-border-strong bg-background-raised px-2.5 py-1.5 text-xs leading-snug font-normal tracking-normal text-foreground normal-case"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}

/** An info icon that explains a label or term. Sits inline after the text it explains. */
export function InfoTip({
  label,
  side,
  children,
}: {
  /** What it explains, for screen readers: "About {label}". */
  label: string;
  side?: Side;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={children} side={side}>
      <button
        type="button"
        aria-label={`About ${label}`}
        className="-m-1.5 inline-flex shrink-0 items-center justify-center rounded-sm p-1.5 text-muted-2 transition-colors hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
