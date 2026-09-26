import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Network, Zap } from "lucide-react";
import { getRole } from "@/lib/session";

export const metadata = {
  title: "Get started — GridFlex",
};

// Placeholder for signup: what happens after account creation. Each card
// starts a different setup flow, and the account type is fixed once it's done.
const paths = [
  {
    href: "/onboarding/participant",
    icon: Zap,
    title: "Provide flexibility",
    description: "Earn by letting your battery, EV, solar, or flexible energy use support the grid.",
    audience: "Homeowners, EV and battery owners, solar owners, and businesses",
    time: "About 2 minutes",
  },
  {
    href: "/onboarding/operator",
    icon: Network,
    title: "Manage a grid",
    description: "Forecast constraints and procure flexibility across your energy network.",
    audience: "Utilities, microgrids, campuses, municipalities, and aggregators",
    time: "About 3 minutes",
  },
];

export default async function OnboardingPage() {
  if (await getRole()) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-14 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
        How will you use GridFlex?
      </h1>
      <p className="mt-3 max-w-lg text-base text-muted">
        We&rsquo;ll set up the right workspace. You can switch accounts later from the account menu.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {paths.map(({ href, icon: Icon, title, description, audience, time }) => (
          <Link
            key={href}
            href={href}
            className="panel group flex flex-col rounded-lg p-6 transition-colors hover:border-border-strong"
          >
            <Icon className="h-6 w-6 text-muted transition-colors group-hover:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="mt-6 text-xl font-semibold text-foreground">{title}</span>
            <span className="mt-2 text-sm leading-relaxed text-muted">{description}</span>
            <span className="mt-4 text-xs leading-relaxed text-muted-2">{audience}</span>
            <span className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted">{time}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                Continue
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
