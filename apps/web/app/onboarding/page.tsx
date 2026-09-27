import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { EarningsEstimator } from "@/components/onboarding/EarningsEstimator";
import { getRole } from "@/lib/session";

export const metadata = {
  title: "Get started | GridFlex",
};

const rise = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as React.CSSProperties;

export default async function OnboardingPage() {
  if (await getRole()) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-14 sm:px-8 sm:py-20">
      <section aria-labelledby="participant-heading">
        <h1
          id="participant-heading"
          className="rise max-w-xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl"
          style={rise(0)}
        >
          Earn by supporting your local grid.
        </h1>
        <p className="rise mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg" style={rise(80)}>
          Put your battery, EV, solar, or flexible energy use to work. Choose what to share,
          set your limits, and earn for the flexibility you provide.
        </p>
        <div className="rise mt-8" style={rise(160)}>
          <EarningsEstimator />
        </div>
        <div
          className="rise mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4"
          style={rise(240)}
        >
          <Link
            href="/onboarding/participant"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition-[color,background-color,transform] hover:bg-white active:scale-[0.97] sm:w-auto"
          >
            Provide flexibility
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="text-sm text-muted">About 2 minutes to set up</p>
        </div>
      </section>

      <section
        aria-labelledby="operator-heading"
        className="rise panel mt-12 rounded-lg p-5 sm:mt-14 sm:p-6"
        style={rise(320)}
      >
        <h2 id="operator-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Do you manage a grid?
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Forecast constraints, find flexibility nearby, and coordinate resources before your
          network reaches its limits. Built for utilities, microgrids, campuses, municipalities,
          and aggregators.
        </p>
        <Link
          href="/onboarding/operator"
          className="group mt-5 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-[color,border-color,transform] hover:border-border-strong active:scale-[0.97]"
        >
          Set up your grid
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </section>
    </main>
  );
}
