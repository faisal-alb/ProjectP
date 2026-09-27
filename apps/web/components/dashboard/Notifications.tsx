"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { Bell, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useMarketStream } from "@/lib/api";
import {
  addNotification,
  notificationFor,
  unreadCount,
  type AppNotification,
  type NotificationTone,
} from "@/lib/notifications";
import type { Role } from "@/lib/profile";
import { Dropdown } from "./Dropdown";

interface NotificationsValue {
  notifications: AppNotification[];
  unread: number;
  markAllRead: () => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsValue>({
  notifications: [],
  unread: 0,
  markAllRead: () => {},
  clear: () => {},
});

const storageKey = (role: Role) => `gridflex:notifications:${role}`;
const EMPTY = "[]";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const read = (role: Role) => {
  try {
    return localStorage.getItem(storageKey(role)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
};

function write(role: Role, list: AppNotification[]) {
  try {
    localStorage.setItem(storageKey(role), JSON.stringify(list));
  } catch {}
  listeners.forEach((l) => l());
}

function parse(raw: string): AppNotification[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Collects market events into a per-role notification list that survives reloads. */
export function NotificationsProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, () => read(role), () => EMPTY);
  const notifications = useMemo(() => parse(raw), [raw]);

  useMarketStream((event) => {
    const next = notificationFor(event, role);
    if (next) write(role, addNotification(parse(read(role)), next));
  }, true);

  const markAllRead = useCallback(
    () => write(role, parse(read(role)).map((n) => ({ ...n, read: true }))),
    [role],
  );
  const clear = useCallback(() => write(role, []), [role]);
  const value = useMemo(
    () => ({ notifications, unread: unreadCount(notifications), markAllRead, clear }),
    [notifications, markAllRead, clear],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);

const TONE: Record<NotificationTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "text-accent" },
  success: { icon: CheckCircle2, className: "text-normal" },
  warning: { icon: TriangleAlert, className: "text-watch" },
};

const timeAgo = (at: number) => {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
};

export function NotificationBell() {
  const { notifications, unread, markAllRead, clear } = useNotifications();
  return (
    <Dropdown
      label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      width="w-80"
      trigger={
        <span className="relative">
          <Bell className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          )}
        </span>
      }
    >
      {() => (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing yet. Grid events will show up here.</p>
          ) : (
            <>
              <ul className="-mx-1 mt-3 max-h-80 space-y-1 overflow-y-auto">
                {notifications.map((n) => {
                  const { icon: Icon, className } = TONE[n.tone];
                  return (
                    <li key={n.id} className="flex gap-2.5 rounded-md px-1 py-2">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} strokeWidth={1.5} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className={`text-sm ${n.read ? "text-muted" : "font-medium text-foreground"}`}>{n.title}</p>
                        <p className="text-xs text-muted">{n.body}</p>
                        <p className="mt-0.5 text-xs text-muted-2">{timeAgo(n.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={clear}
                className="mt-2 w-full border-t border-border pt-2 text-center text-xs text-muted hover:text-foreground"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}
