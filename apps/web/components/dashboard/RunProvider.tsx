"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RunState } from "@gridflex/shared";
import { API_URL } from "@/lib/api";

const Context = createContext<{
  run: RunState | null;
  connected: boolean;
  refresh: () => void;
}>({ run: null, connected: false, refresh: () => {} });
export function RunProvider({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState<RunState | null>(null);
  const [connected, setConnected] = useState(false);
  const revision = useRef<{ id: string; version: number } | null>(null);
  const accept = useCallback((next: RunState | null) => {
    if (!next) return;
    if (
      revision.current?.id === next.id &&
      revision.current.version > next.version
    )
      return;
    revision.current = { id: next.id, version: next.version };
    setRun(next);
  }, []);
  const refresh = useCallback(() => {
    fetch(`${API_URL}/runs/current`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        accept(d.run);
        setConnected(true);
      })
      .catch(() => setConnected(false));
  }, [accept]);
  useEffect(() => {
    refresh();
    const stream = new EventSource(`${API_URL}/runs/stream`);
    stream.onopen = () => {
      setConnected(true);
      refresh();
    };
    stream.onerror = () => setConnected(false);
    stream.addEventListener("snapshot", (e) => {
      accept(JSON.parse((e as MessageEvent).data).run);
      setConnected(true);
    });
    return () => stream.close();
  }, [accept, refresh]);
  return (
    <Context.Provider value={{ run, connected, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useRun = () => useContext(Context);
export const runTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
export async function presenterRequest(path: string, body?: unknown) {
  const token = sessionStorage.getItem("gridflex-presenter") ?? "";
  const res = await fetch(`${API_URL}/runs/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
