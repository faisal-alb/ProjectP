import Link from "next/link";
import { Wordmark } from "./Logo";

const links = [
  { label: "Product", href: "#how-it-works" },
  { label: "Technology", href: "#technology" },
  { label: "GitHub", href: "https://github.com" },
  { label: "Demo", href: "/dashboard" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm text-muted">
              Distributed flexibility infrastructure for the electric grid.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-muted">
            Built for the hackathon · Powered by Solana
          </p>
        </div>
      </div>
    </footer>
  );
}
