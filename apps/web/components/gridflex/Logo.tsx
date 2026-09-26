export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="6" r="2.4" fill="currentColor" />
      <circle cx="6" cy="22" r="2.4" fill="currentColor" />
      <circle cx="26" cy="22" r="2.4" fill="currentColor" />
      <circle cx="16" cy="16" r="2.8" fill="currentColor" />
      <path
        d="M16 8.4V13.4M14 17.6L7.6 20.4M18 17.6L24.4 20.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo className="h-6 w-6 text-primary" />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">
        GridFlex
      </span>
    </span>
  );
}
