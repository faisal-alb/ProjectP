"use client";

import { Wallet } from "lucide-react";
import { shortAddress } from "@/lib/api";
import { Dropdown } from "./Dropdown";
import { useHousehold } from "./HouseholdProvider";
import { useSolana } from "./SolanaProvider";
import { TxLink } from "./TxLink";

/**
 * The household's wallet in the header. GridFlex holds it for them, so there
 * is nothing to connect: it just shows what they've earned and where it is.
 */
export function HouseholdWalletButton() {
  const { apiStatus } = useSolana();
  const household = useHousehold();

  if (apiStatus !== "online" || !household) {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-2">
        <Wallet className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        {apiStatus === "loading" ? "Wallet…" : "Wallet offline"}
      </span>
    );
  }

  const lastPayout = household.payouts[0];
  return (
    <Dropdown
      label="Your wallet"
      trigger={
        <>
          <Wallet className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <span className="font-mono text-xs tabular">{household.balance.formatted}</span>
        </>
      }
    >
      {() => (
        <div>
          <p className="text-xs text-muted">Your GridFlex wallet</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {household.balance.formatted} <span className="text-sm font-normal text-muted">USDC</span>
          </p>
          {lastPayout && (
            <p className="mt-1 text-xs text-muted">
              Last payment <span className="font-mono text-foreground">{lastPayout.amount.formatted}</span> for the{" "}
              {lastPayout.window} event
            </p>
          )}
          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">
            Payments for the energy your battery shares land here automatically, in USDC on Solana. We hold this
            wallet for you, so there&rsquo;s nothing to set up.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-muted-2">{shortAddress(household.wallet)}</span>
            <TxLink href={household.walletUrl} label="View on Solana Explorer" />
          </div>
        </div>
      )}
    </Dropdown>
  );
}
