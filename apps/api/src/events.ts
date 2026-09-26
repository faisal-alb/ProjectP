import { EventEmitter } from "node:events";

export type MarketEventType =
  | "market.created"
  | "commitment.accepted"
  | "verification.completed"
  | "settlement.completed"
  | "market.closed"
  | "market.failed";

export interface MarketEvent {
  type: MarketEventType;
  marketId: string;
  data?: unknown;
}

export const bus = new EventEmitter();
bus.setMaxListeners(100);

export function publish(event: MarketEvent) {
  bus.emit("event", event);
}
