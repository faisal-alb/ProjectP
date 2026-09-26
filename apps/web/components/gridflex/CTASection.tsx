import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <div className="rounded-3xl bg-dark px-6 py-14 text-center sm:px-16 sm:py-20">
      <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        See GridFlex balance the grid in real time.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-balance text-dark-muted">
        Run the interactive demo and watch GridFlex predict congestion,
        coordinate distributed resources, verify delivery, and settle the
        market.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-bright px-6 py-3 text-sm font-medium text-dark transition-colors hover:bg-bright/90 sm:w-auto"
        >
          Launch Grid Demo
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <a
          href="#technology"
          className="inline-flex w-full items-center justify-center rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.06] sm:w-auto"
        >
          View Architecture
        </a>
      </div>
    </div>
  );
}
