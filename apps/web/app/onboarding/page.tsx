import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BatteryCharging, ShieldCheck, Wallet } from "lucide-react";
import { getRole } from "@/lib/session";

export const metadata = {
  title: "Get started | GridFlex",
};

const highlights = [
  { icon: BatteryCharging, label: "Batteries, EVs and solar" },
  { icon: ShieldCheck, label: "You set the limits" },
  { icon: Wallet, label: "Paid for what you provide" },
];

const rise = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as React.CSSProperties;

export default async function OnboardingPage() {
  if (await getRole()) redirect("/dashboard");

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-14 sm:px-8 sm:py-20">
        <section aria-labelledby="participant-heading">
          <p className="rise tracked-caps text-xs font-semibold text-accent" style={rise(0)}>
            For households and businesses
          </p>
          <h1
            id="participant-heading"
            className="rise mt-4 max-w-xl text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl"
            style={rise(80)}
          >
            Earn by supporting your <span className="gradient-text">local grid.</span>
          </h1>
          <p className="rise mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-lg" style={rise(160)}>
            Put your battery, EV, solar, or flexible energy use to work. Choose what to share,
            set your limits, and earn for the flexibility you provide.
          </p>
          <div
            className="rise mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4"
            style={rise(240)}
          >
            <Link
              href="/onboarding/participant"
              className="gradient-button inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-semibold sm:w-auto"
            >
              Provide flexibility
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="text-sm text-muted">About 2 minutes to set up</p>
          </div>
          <ul className="rise mt-8 flex flex-wrap gap-2" style={rise(320)}>
            {highlights.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background-raised/70 px-3 py-1.5 text-xs text-muted backdrop-blur"
              >
                <Icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="operator-heading"
          className="rise mt-14 rounded-lg bg-background-raised/60 p-5 backdrop-blur sm:mt-16 sm:p-6"
          style={rise(400)}
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
            className="group mt-5 inline-flex items-center gap-2 rounded-md border border-border-strong px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Set up your grid
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </section>
      </main>
    </div>
  );
}
