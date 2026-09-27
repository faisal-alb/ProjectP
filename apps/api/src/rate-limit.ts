// Fixed-window rate limits for the routes that spend SOL: the faucet pays fee
// SOL and mints, and the lifecycle steps are signed (and paid for) by the
// verifier. CORS is not authorization; limits only bound demo spending.
// In memory, which is fine because the API runs as a single process.
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

import { HTTPException } from "hono/http-exception";

const trustProxy = process.env.TRUST_PROXY === "1";

/**
 * The caller's address. Behind a proxy (Dokploy's Traefik), the socket address
 * is the proxy's, so the last X-Forwarded-For entry is used instead; only
 * trust it when TRUST_PROXY=1, since a direct caller can set the header. This assumes exactly one trusted
 * proxy that appends the actual peer address; do not expose the API port.
 */
export function clientIp(c: Context): string {
  if (trustProxy) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

interface Window {
  start: number;
  count: number;
}

/**
 * Allow `limit` requests per `windowMs`, per client and, when `globalLimit` is
 * set, across all clients. Answers 429 with Retry-After once either is used up.
 */
export function rateLimit(opts: {
  name: string;
  limit: number;
  windowMs: number;
  globalLimit?: number;
}): MiddlewareHandler {
  const perClient = new Map<string, Window>();
  let global: Window = { start: Date.now(), count: 0 };

  return async (c, next) => {
    const now = Date.now();
    if (now - global.start >= opts.windowMs) {
      global = { start: now, count: 0 };
      perClient.clear();
    }
    const ip = clientIp(c);
    const mine = perClient.get(ip) ?? { start: global.start, count: 0 };
    const retryAfter = Math.ceil((global.start + opts.windowMs - now) / 1000);

    if (mine.count >= opts.limit || (opts.globalLimit !== undefined && global.count >= opts.globalLimit)) {
      c.header("Retry-After", String(retryAfter));
      throw new HTTPException(429, { message: `Too many ${opts.name} requests. Try again in ${Math.ceil(retryAfter / 60)} min.` });
    }
    mine.count++;
    global.count++;
    perClient.set(ip, mine);
    await next();
  };
}
