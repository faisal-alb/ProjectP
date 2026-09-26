import Link from "next/link";
import { Wordmark } from "./Logo";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Flexibility", href: "#flexibility" },
  { label: "Network", href: "#network" },
  { label: "Settlement", href: "#settlement" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="tracked-caps text-[11px] font-medium text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="hidden rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-border-strong hover:text-foreground sm:inline-flex"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-white"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
