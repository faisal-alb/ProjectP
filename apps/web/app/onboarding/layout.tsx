import Link from "next/link";
import { Wordmark } from "@/components/gridflex/Logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/onboarding" aria-label="GridFlex, back to the start">
            <Wordmark />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
