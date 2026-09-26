import type { ZoneStatus } from "@/lib/demo-data";

const statusConfig: Record<
  ZoneStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  normal: {
    label: "Normal",
    dot: "bg-bright",
    text: "text-primary",
    bg: "bg-soft",
  },
  watch: {
    label: "Watch",
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning-soft",
  },
  high: {
    label: "High",
    dot: "bg-danger",
    text: "text-danger",
    bg: "bg-danger-soft",
  },
};

export function GridStatusBadge({ status }: { status: ZoneStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${
          status === "high" ? "animate-pulse" : ""
        }`}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
