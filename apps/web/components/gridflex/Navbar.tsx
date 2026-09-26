import Link from "next/link";
import { Wordmark } from "./Logo";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Network", href: "#network" },
  { label: "Technology", href: "#technology" },
  { label: "About", href: "#about" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/[.04] sm:inline-flex"
          >
            View Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Launch Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
