"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useSignTransaction } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { formatUsdc, kwToWh, minEscrowBase, priceToBasePerKwh } from "@gridflex/shared";
import { api, base64ToBytes, bytesToBase64, chainFor, clusterLabel, type MarketDto } from "@/lib/api";
import { useOperatorWallet, WalletOptions } from "./OperatorWallet";
import { useSolana } from "./SolanaProvider";
import { TxLink } from "./TxLink";
import { InfoTip } from "@/components/ui/Tooltip";

const primaryButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-[color,background-color,transform] hover:bg-white active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-[color,border-color,transform] hover:border-border-strong active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The request's money, front and centre: how much USDC the escrow holds or
 * will hold, the one next step, and how much of the need is covered.
 */
export function EscrowCard({
  market,
  cap,
  requiredKw,
  plannedKw,
  covered,
  onMarket,
  onReset,
}: {
  market: MarketDto | null;
  cap: number;
  requiredKw: number;
  /** Covered kW at the current price, before anything is on-chain. */
  plannedKw: number;
  covered: boolean;
  onMarket: (market: MarketDto) => void;
  onReset: () => void;
}) {
  const { apiStatus, health } = useSolana();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const escrow = minEscrowBase(kwToWh(requiredKw), priceToBasePerKwh(cap));
  const live = apiStatus === "online" && health;
  const funded = market && market.phase !== "awaiting-signature" ? market : null;

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }
  const step = (path: "verify" | "settle", label: string) => () =>
    run(label, async () => {
      const res = await api<{ market: MarketDto }>(`/markets/${funded!.id}/${path}`, { method: "POST" });
      onMarket(res.market);
    });

  const committedKw = funded ? funded.committedKw : plannedKw;
  const pct = Math.min(100, (committedKw / requiredKw) * 100);

  return (
    <div className="w-full shrink-0 rounded-md border border-border-strong bg-background-raised p-4 lg:w-80">
      <div className="flex items-baseline justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          USDC escrow
          <InfoTip label="USDC escrow" side="bottom">
            Money you lock up before the event. It&rsquo;s paid to participants only once their delivery is verified, and returned to you if it isn&rsquo;t.
          </InfoTip>
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted-2">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-normal" : "bg-muted-2"}`} aria-hidden="true" />
          {live ? `Solana ${clusterLabel(health.cluster)}` : "Offline"}
        </span>
      </div>

      <Headline market={funded} escrow={escrow} />

      <div className="mt-4">
        {!live ? (
          <p className="text-xs leading-relaxed text-muted">
            {apiStatus === "loading"
              ? "Checking the settlement service…"
              : "Live settlement is offline, so this is a preview. Start the API (npm run dev) to fund it with USDC."}
          </p>
        ) : !funded ? (
          <FundStep
            chain={chainFor(health.cluster)}
            cap={cap}
            escrow={escrow}
            covered={covered}
            busy={busy}
            run={run}
            onMarket={onMarket}
          />
        ) : funded.phase === "committed" || funded.phase === "verified" ? (
          <div>
            <button
              type="button"
              className={primaryButton}
              disabled={!!busy}
              onClick={
                funded.phase === "committed"
                  ? step("verify", "Recording meter readings…")
                  : step("settle", "Paying participants…")
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ?? (funded.phase === "committed" ? "Record meter readings" : "Pay participants")}
            </button>
            <p className="mt-2 text-xs text-muted-2">Simulation control. Automated settlement runs after the event ends in production.</p>
          </div>
        ) : funded.phase === "settled" ? (
          <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <TxLink href={funded.transactions.close} label="View refund" />
              <TxLink href={funded.addressUrl} label="View market record" />
            </div>
            <button type="button" className={`${secondaryButton} mt-3`} onClick={onReset}>
              Start a new request
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Recording commitments on Solana…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-md border border-risk/40 px-3 py-2 text-xs text-foreground">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted">
            Flexibility committed
            <InfoTip label="flexibility committed">
              Power that participants have promised to deliver, out of what this event needs.
            </InfoTip>
          </span>
          <span className="font-mono tabular text-foreground">
            {committedKw} / {requiredKw} kW
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-white/[0.06]">
          <div
            className={`h-full w-full origin-left transition-transform duration-200 ${committedKw >= requiredKw ? "bg-normal" : "bg-watch"}`}
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
        {committedKw < requiredKw && (
          <p className="mt-1.5 text-xs font-medium text-watch">{requiredKw - committedKw} kW still needed</p>
        )}
      </div>
    </div>
  );
}

function Headline({ market, escrow }: { market: MarketDto | null; escrow: bigint }) {
  if (market?.phase === "settled") {
    return (
      <div className="mt-2">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-foreground">{market.paid?.formatted}</span>
          <span className="text-sm text-muted">paid</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Check className="h-3.5 w-3.5 text-normal" aria-hidden="true" />
          To {market.commitments.length} participants · {market.refund?.formatted} refunded to you
        </p>
      </div>
    );
  }
  if (market) {
    return (
      <div className="mt-2">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-foreground">{market.escrow.formatted}</span>
          <span className="text-sm text-muted">locked</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {market.phase === "verified"
            ? "Delivery verified. Ready to pay participants."
            : `Held for ${market.commitments.length} participants until delivery is verified.`}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-foreground">{formatUsdc(escrow)}</span>
        <span className="text-sm text-muted">to lock</span>
      </p>
      <p className="mt-1 text-xs text-muted">Pays for verified delivery only. Whatever isn&rsquo;t used is refunded.</p>
    </div>
  );
}

function FundStep({
  chain,
  cap,
  escrow,
  covered,
  busy,
  run,
  onMarket,
}: {
  chain: `solana:${string}`;
  cap: number;
  escrow: bigint;
  covered: boolean;
  busy: string | null;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
  onMarket: (market: MarketDto) => void;
}) {
  const { connection, balance, getTestUsdc } = useOperatorWallet();
  if (!connection) {
    return (
      <div>
        <p className="mb-2 text-xs text-muted">Connect a wallet to fund this request</p>
        <WalletOptions />
      </div>
    );
  }
  return (
    <Fund
      account={connection.account}
      chain={chain}
      cap={cap}
      escrow={escrow}
      covered={covered}
      enough={balance !== null && BigInt(balance.base) >= escrow}
      balanceKnown={balance !== null}
      busy={busy}
      run={run}
      onMarket={onMarket}
      getTestUsdc={getTestUsdc}
    />
  );
}

function Fund({
  account,
  chain,
  cap,
  escrow,
  covered,
  enough,
  balanceKnown,
  busy,
  run,
  onMarket,
  getTestUsdc,
}: {
  account: UiWalletAccount;
  chain: `solana:${string}`;
  cap: number;
  escrow: bigint;
  covered: boolean;
  enough: boolean;
  balanceKnown: boolean;
  busy: string | null;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
  onMarket: (market: MarketDto) => void;
  getTestUsdc: () => Promise<void>;
}) {
  const signTransaction = useSignTransaction(account, chain);
  const { refreshBalance } = useOperatorWallet();

  if (balanceKnown && !enough) {
    return (
      <div>
        <button
          type="button"
          className={primaryButton}
          disabled={!!busy}
          onClick={() => run("Getting test USDC…", getTestUsdc)}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ?? "Get test USDC"}
        </button>
        <p className="mt-2 text-xs text-muted">Your wallet needs {formatUsdc(escrow)} USDC to fund this request.</p>
      </div>
    );
  }

  const fund = () =>
    run("Waiting for your wallet…", async () => {
      const opened = await api<{ market: MarketDto; transaction: string }>("/markets", {
        method: "POST",
        body: { operatorWallet: account.address, maxPricePerKwh: cap },
      });
      const { signedTransaction } = await signTransaction({ transaction: base64ToBytes(opened.transaction) });
      const confirmed = await api<{ market: MarketDto }>(`/markets/${opened.market.id}/confirm`, {
        method: "POST",
        body: { signedTransaction: bytesToBase64(signedTransaction) },
      });
      onMarket(confirmed.market);
      await refreshBalance();
    });

  return (
    <div>
      <button type="button" className={primaryButton} disabled={!covered || !balanceKnown || !!busy} onClick={fund}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ?? `Fund request · ${formatUsdc(escrow)}`}
      </button>
      <p className={`mt-2 text-xs ${covered ? "text-muted-2" : "text-watch"}`}>
        {covered
          ? "Your wallet signs once to lock the USDC. GridFlex handles the rest."
          : "Raise your price below to cover the full need first."}
      </p>
    </div>
  );
}
