"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { useConnect, useDisconnect, useWallets, type UiWallet, type UiWalletAccount } from "@wallet-standard/react";
import { SolanaSignTransaction } from "@solana/wallet-standard-features";
import { api, explorerAddressUrl, shortAddress, useMarketEvents, type Money } from "@/lib/api";
import { Dropdown } from "./Dropdown";
import { useSolana } from "./SolanaProvider";
import { TxLink } from "./TxLink";

interface Connection {
  account: UiWalletAccount;
  wallet: UiWallet;
}

interface OperatorWalletValue {
  connection: Connection | null;
  connect: (connection: Connection) => void;
  disconnect: () => void;
  balance: Money | null;
  refreshBalance: () => Promise<void>;
  getTestUsdc: () => Promise<void>;
}

const OperatorWalletContext = createContext<OperatorWalletValue | null>(null);

/** The grid operator's connected wallet, shared by the header and the escrow card. */
export function OperatorWalletProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [balance, setBalance] = useState<Money | null>(null);
  const address = connection?.account.address;

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    const res = await api<{ balance: Money }>(`/wallets/${address}/usdc`);
    setBalance(res.balance);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    api<{ balance: Money }>(`/wallets/${address}/usdc`)
      .then((res) => !cancelled && setBalance(res.balance))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Escrow and refunds move this wallet's USDC; refresh when the market changes.
  const { apiStatus } = useSolana();
  useMarketEvents(() => void refreshBalance().catch(() => {}), apiStatus === "online" && !!address);

  const getTestUsdc = useCallback(async () => {
    if (!address) return;
    const res = await api<{ balance: Money }>("/faucet", { method: "POST", body: { wallet: address } });
    setBalance(res.balance);
  }, [address]);

  return (
    <OperatorWalletContext.Provider
      value={{
        connection,
        connect: setConnection,
        disconnect: () => {
          setConnection(null);
          setBalance(null);
        },
        balance,
        refreshBalance,
        getTestUsdc,
      }}
    >
      {children}
    </OperatorWalletContext.Provider>
  );
}

export function useOperatorWallet() {
  const value = useContext(OperatorWalletContext);
  if (!value) throw new Error("useOperatorWallet must be used inside OperatorWalletProvider");
  return value;
}

/** Installed Wallet Standard wallets that can sign Solana transactions. */
export function WalletOptions({ onConnected }: { onConnected?: () => void }) {
  const { connect } = useOperatorWallet();
  const wallets = useWallets().filter(
    (w) => w.features.includes(SolanaSignTransaction) && w.features.includes("standard:connect"),
  );
  if (wallets.length === 0) {
    return (
      <p className="text-sm text-muted">
        No Solana wallet found in this browser. Install{" "}
        <a className="text-foreground underline underline-offset-2" href="https://phantom.com" target="_blank" rel="noreferrer">
          Phantom
        </a>{" "}
        or{" "}
        <a className="text-foreground underline underline-offset-2" href="https://solflare.com" target="_blank" rel="noreferrer">
          Solflare
        </a>
        , then reload.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {wallets.map((wallet) => (
        <WalletOption
          key={wallet.name}
          wallet={wallet}
          onConnected={(account) => {
            connect({ account, wallet });
            onConnected?.();
          }}
        />
      ))}
    </div>
  );
}

function WalletOption({ wallet, onConnected }: { wallet: UiWallet; onConnected: (a: UiWalletAccount) => void }) {
  const [connecting, connect] = useConnect(wallet);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      disabled={connecting}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-50"
      onClick={async () => {
        setFailed(false);
        try {
          const accounts = await connect();
          if (accounts[0]) onConnected(accounts[0]);
        } catch {
          setFailed(true);
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs */}
      <img src={wallet.icon} alt="" className="h-4 w-4 rounded-sm" />
      {connecting ? "Connecting…" : failed ? `Retry ${wallet.name}` : wallet.name}
    </button>
  );
}

/** Header control: connect a wallet, or see the connected one and its USDC. */
export function OperatorWalletButton() {
  const { apiStatus, health } = useSolana();
  const { connection, balance } = useOperatorWallet();
  if (apiStatus !== "online" || !health) return null;

  if (!connection) {
    return (
      <Dropdown
        label="Connect wallet"
        trigger={
          <>
            <Wallet className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
            <span>Connect wallet</span>
          </>
        }
      >
        {(close) => (
          <div>
            <p className="text-sm font-medium text-foreground">Connect the wallet that funds requests</p>
            <p className="mt-1 text-xs text-muted">It signs one transaction per request: the USDC escrow.</p>
            <div className="mt-3">
              <WalletOptions onConnected={close} />
            </div>
          </div>
        )}
      </Dropdown>
    );
  }

  return (
    <Dropdown
      label="Wallet"
      trigger={
        <>
          <Wallet className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <span className="font-mono text-xs tabular">{balance ? balance.formatted : "…"}</span>
          <span className="hidden text-xs text-muted sm:inline">{shortAddress(connection.account.address)}</span>
        </>
      }
    >
      {(close) => <ConnectedWallet connection={connection} close={close} />}
    </Dropdown>
  );
}

function ConnectedWallet({ connection, close }: { connection: Connection; close: () => void }) {
  const { health } = useSolana();
  const { balance, getTestUsdc, disconnect } = useOperatorWallet();
  const [, disconnectWallet] = useDisconnect(connection.wallet);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="text-xs text-muted">{connection.wallet.name}</p>
      <p className="mt-0.5 font-mono text-sm text-foreground">{shortAddress(connection.account.address)}</p>
      <p className="mt-3 text-xs text-muted">Balance</p>
      <p className="mt-0.5 text-xl font-semibold text-foreground">
        {balance?.formatted ?? "…"} <span className="text-sm font-normal text-muted">USDC</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {health && <TxLink href={explorerAddressUrl(health, connection.account.address)} label="View on Solana Explorer" />}
        {health?.cluster !== "mainnet-beta" && (
          <button
            type="button"
            disabled={busy}
            className="text-xs text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              await getTestUsdc().catch(() => {});
              setBusy(false);
            }}
          >
            {busy ? "Adding test USDC…" : "Get test USDC"}
          </button>
        )}
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-strong"
        onClick={async () => {
          await disconnectWallet().catch(() => {});
          disconnect();
          close();
        }}
      >
        Disconnect
      </button>
    </div>
  );
}
