import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <div className="relative overflow-hidden rounded-lg panel px-6 py-14 text-center sm:px-16 sm:py-20">
      <div className="relative">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          See GridFlex balance the grid in real time.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted">
          Explore the grid simulation and watch GridFlex predict congestion,
          coordinate distributed resources, verify delivery, and settle the
          market.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-semibold text-background transition-[color,background-color,transform] hover:bg-white active:scale-[0.97] sm:w-auto"
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href="#technology"
            className="inline-flex w-full items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-[color,border-color,transform] hover:border-border-strong active:scale-[0.97] sm:w-auto"
          >
            View Architecture
          </a>
        </div>
      </div>
    </div>
  );
}
