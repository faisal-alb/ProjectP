"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "./Logo";

const links = [
  { label: "Overview", id: null },
  { label: "How it works", id: "how-it-works" },
  { label: "Flexibility", id: "flexibility" },
  { label: "Network", id: "network" },
  { label: "Settlement", id: "settlement" },
] as const;

const NAV_HEIGHT = 72;

/** Which nav item the page is currently in: the last section whose top has passed a line a third down the viewport. */
function currentIndex() {
  const line = NAV_HEIGHT + window.innerHeight / 3;
  let index = 0;
  links.forEach((link, i) => {
    if (!link.id) return;
    const el = document.getElementById(link.id);
    if (el && el.getBoundingClientRect().top <= line) index = i;
  });
  return index;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll to the top and drop any #section from the URL, rather than adding #top. */
function scrollToTop(event: React.MouseEvent) {
  if (window.location.pathname !== "/") return;
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  history.replaceState(history.state, "", window.location.pathname + window.location.search);
}

export function Navbar() {
  const [active, setActive] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  // While a click-initiated scroll is running, the pill stays on the clicked item
  // instead of stepping through every section on the way.
  const followingClick = useRef(false);

  // One pill for the whole nav, placed with a transform so it slides to the current item.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const place = () => {
      const item = nav.querySelectorAll<HTMLElement>("[data-nav-item]")[active];
      if (!item) return;
      pill.style.transform = `translateX(${item.offsetLeft}px)`;
      pill.style.width = `${item.offsetWidth}px`;
    };
    place();
    const frame = requestAnimationFrame(() => (pill.dataset.ready = "true"));
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active]);

  // Follow the reader's scroll position.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (followingClick.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(currentIndex()));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const select = (i: number) => {
    setActive(i);
    followingClick.current = true;
    const release = () => {
      followingClick.current = false;
      window.removeEventListener("scrollend", release);
      clearTimeout(fallback);
    };
    window.addEventListener("scrollend", release);
    // scrollend doesn't fire if nothing scrolls, and older Safari lacks it.
    const fallback = setTimeout(release, 1200);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="shrink-0"
          onClick={(e) => {
            scrollToTop(e);
            select(0);
          }}
        >
          <Wordmark />
        </Link>

        <nav
          ref={navRef}
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-1 md:flex"
        >
          <span ref={pillRef} className="nav-pill" aria-hidden="true" />
          {links.map((link, i) => (
            <a
              key={link.label}
              href={link.id ? `#${link.id}` : "/"}
              data-nav-item
              aria-current={i === active ? "location" : undefined}
              onClick={(e) => {
                if (!link.id) scrollToTop(e);
                select(i);
              }}
              className={`relative rounded-full border border-transparent px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300 ${
                i === active ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href="/dashboard"
          className="btn-volt inline-flex items-center rounded-full px-4 py-2 text-[13px] font-semibold"
        >
          Get Started
        </Link>
      </div>
    </header>
  );
}
