import type { ZoneStatus } from "@/lib/demo-data";

const statusConfig: Record<
  ZoneStatus,
  { label: string; dot: string; text: string }
> = {
  normal: {
    label: "Normal",
    dot: "bg-normal",
    text: "text-normal",
  },
  watch: {
    label: "Watch",
    dot: "bg-watch",
    text: "text-watch",
  },
  high: {
    label: "High",
    dot: "bg-risk",
    text: "text-risk",
  },
};

export function GridStatusBadge({
  status,
  compact = false,
  className = "",
}: {
  status: ZoneStatus;
  compact?: boolean;
  className?: string;
}) {
  const config = statusConfig[status];

  if (compact) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <span
          className={`h-2 w-2 rounded-full ${config.dot} ${
            status === "high" ? "animate-pulse" : ""
          }`}
        />
        <span className="sr-only">{config.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.text} ${className}`}
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
