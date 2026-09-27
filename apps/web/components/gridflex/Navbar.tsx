import Link from "next/link";
import { Wordmark } from "./Logo";

const links = [
  { label: "Overview", href: "#top" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Flexibility", href: "#flexibility" },
  { label: "Network", href: "#network" },
  { label: "Settlement", href: "#settlement" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-1 backdrop-blur-md md:flex"
        >
          {links.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                i === 0
                  ? "border border-white/[0.08] bg-white/[0.08] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "border border-transparent text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href="/dashboard"
          className="btn-ember inline-flex items-center rounded-full px-4 py-2 text-[13px] font-semibold"
        >
          Get Started
        </Link>
      </div>
    </header>
  );
}
