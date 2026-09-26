import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getRole } from "@/lib/session";

export const metadata = {
  title: "Get started — GridFlex",
};

export default async function OnboardingPage() {
  if (await getRole()) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-14 sm:px-8 sm:py-20">
      <section aria-labelledby="participant-heading">
        <h1 id="participant-heading" className="max-w-lg text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Earn by supporting your local grid.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
          Put your battery, EV, solar, or flexible energy use to work. Choose what to share,
          set your limits, and earn for the flexibility you provide.
        </p>
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/onboarding/participant"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition-colors hover:bg-white sm:w-auto"
          >
            Provide flexibility
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="text-sm text-muted">About 2 minutes to set up</p>
        </div>
      </section>

      <section aria-labelledby="operator-heading" className="mt-14 border-t border-border pt-8 sm:mt-16 sm:pt-10">
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
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
        >
          Set up your grid
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
