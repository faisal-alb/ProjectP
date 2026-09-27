import Link from "next/link";
import { Wordmark } from "@/components/gridflex/Logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="relative z-10">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="GridFlex, back to the homepage">
            <Wordmark />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
