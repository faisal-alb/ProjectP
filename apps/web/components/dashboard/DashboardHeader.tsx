"use client";

import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { signOut } from "@/app/actions";
import type { Role } from "@/lib/profile";
import { Logo, Wordmark } from "@/components/gridflex/Logo";
import { DashboardNav } from "./DashboardNav";
import { Dropdown } from "./Dropdown";
import { NotificationBell } from "./Notifications";
import { HouseholdWalletButton } from "./HouseholdWallet";
import { OperatorWalletButton } from "./OperatorWallet";
import { useSecretTap } from "./Simulator";
import { useSolana } from "./SolanaProvider";

const ROLE_DESCRIPTION: Record<Role, string> = { participant: "Flexibility provider", operator: "Grid operator" };

export function DashboardHeader({ role, label }: { role: Role; label: string }) {
  const onLabelTap = useSecretTap();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="GridFlex home">
            <span className="hidden sm:block">
              <Wordmark />
            </span>
            <Logo className="h-6 w-6 text-foreground sm:hidden" />
          </Link>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
          <span className="select-none truncate text-sm text-muted" onClick={onLabelTap}>
            {label}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NetworkStatus />
          {role === "participant" ? <HouseholdWalletButton /> : <OperatorWalletButton />}
          <NotificationBell />
          <AccountMenu role={role} label={label} />
        </div>
      </div>
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <DashboardNav role={role} />
      </div>
    </header>
  );
}

function NetworkStatus() {
  const { apiStatus, health } = useSolana();
  const online = apiStatus === "online" && health;
  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted md:inline-flex"
      title={online ? `Settling in USDC on Solana ${health.cluster}` : "Live settlement is unavailable"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-normal" : "bg-muted-2"}`} aria-hidden="true" />
      {online ? "Solana" : apiStatus === "loading" ? "Connecting…" : "Solana offline"}
    </span>
  );
}

function AccountMenu({ role, label }: { role: Role; label: string }) {
  return (
    <Dropdown
      label="Account"
      trigger={
        <>
          <UserRound className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        </>
      }
    >
      {() => (
        <div>
          <p className="text-xs text-muted">Signed in as</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted">{ROLE_DESCRIPTION[role]}</p>
          <p className="mt-2 text-xs text-muted-2">All figures on this dashboard are illustrative.</p>
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-[color,border-color,transform] hover:border-border-strong active:scale-[0.97]"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/"
              className="block rounded-md px-3 py-1.5 text-center text-sm text-muted transition-colors hover:text-foreground"
            >
              Back to site
            </Link>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
