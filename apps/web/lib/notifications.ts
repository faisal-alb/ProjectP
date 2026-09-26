import type { Role } from "@/lib/profile";

export type NotificationTone = "info" | "success" | "warning";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  tone: NotificationTone;
  at: number;
  read: boolean;
}

interface Copy {
  title: string;
  body: string;
  tone: NotificationTone;
}

const COPY: Record<string, Record<Role, Copy>> = {
  "market.created": {
    participant: {
      title: "Grid stress expected tonight",
      body: "A flexibility request is open for your zone. Check tonight's Power Plan.",
      tone: "warning",
    },
    operator: { title: "Flexibility request opened", body: "Waiting for resources to commit.", tone: "info" },
  },
  "commitment.accepted": {
    participant: { title: "Commitment recorded", body: "Your flexibility is locked in for tonight.", tone: "info" },
    operator: { title: "Commitment accepted", body: "Resources are committed. Delivery is next.", tone: "info" },
  },
  "verification.completed": {
    participant: { title: "Delivery verified", body: "Your delivery was confirmed. Payment is on its way.", tone: "success" },
    operator: { title: "Delivery verified", body: "Meter data matches the commitment.", tone: "success" },
  },
  "settlement.completed": {
    participant: { title: "You got paid", body: "Settlement finished. Your payout is in your wallet.", tone: "success" },
    operator: { title: "Settlement complete", body: "Payments were recorded on Solana.", tone: "success" },
  },
  "market.closed": {
    participant: { title: "Event closed", body: "Tonight's grid event has ended.", tone: "info" },
    operator: { title: "Market closed", body: "The flexibility request has ended.", tone: "info" },
  },
  "market.failed": {
    participant: {
      title: "Something went wrong",
      body: "Tonight's event hit a problem. Nothing was charged.",
      tone: "warning",
    },
    operator: { title: "Market failed", body: "The market hit an error and stopped.", tone: "warning" },
  },
};

/** Turn a market event into a notification for this role, or null if it isn't one we surface. */
export function notificationFor(
  event: { type: string; marketId: string; data?: unknown },
  role: Role,
  now = Date.now(),
): AppNotification | null {
  const copy = COPY[event.type]?.[role];
  if (!copy) return null;
  const detail =
    event.type === "market.failed" && role === "operator"
      ? (event.data as { message?: string } | undefined)?.message
      : undefined;
  return {
    id: `${event.marketId}:${event.type}`,
    title: copy.title,
    body: detail ? `${copy.body} ${detail}` : copy.body,
    tone: copy.tone,
    at: now,
    read: false,
  };
}

export const MAX_NOTIFICATIONS = 30;

/** Add a notification to the top of the list; a repeat of the same id replaces the old one. */
export function addNotification(list: AppNotification[], next: AppNotification): AppNotification[] {
  return [next, ...list.filter((n) => n.id !== next.id)].slice(0, MAX_NOTIFICATIONS);
}

export const unreadCount = (list: AppNotification[]) => list.filter((n) => !n.read).length;
