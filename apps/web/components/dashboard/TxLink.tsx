import { ArrowUpRight } from "lucide-react";

export function TxLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
    >
      {label}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
