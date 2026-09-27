import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0c0c0e] px-6 py-16 text-center sm:px-16 sm:py-24">
      {/* The hero's light, returning at the close of the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(55%_70%_at_50%_0%,rgba(127,180,204,0.16),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-px left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[#cfe6f0] to-transparent"
      />

      <div className="relative">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-[2.75rem] sm:leading-[1.1]">
          See GridFlex balance the grid{" "}
          <span className="text-volt-gradient">in real time.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-balance text-muted">
          Explore a complete energy day and watch GridFlex predict congestion,
          coordinate distributed resources, verify delivery, and settle the
          market.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="btn-volt inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href="#technology"
            className="btn-ghost-pill inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-medium sm:w-auto"
          >
            View Architecture
          </a>
        </div>
      </div>
    </div>
  );
}
