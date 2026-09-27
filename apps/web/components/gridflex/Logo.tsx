import Image from "next/image";

/** The GridFlex mark: a light ring and spokes around a hex grid node, for dark surfaces. */
export function Logo({ className = "" }: { className?: string }) {
  return <Image src="/logo.png" alt="" width={32} height={32} className={className} />;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo className="h-6 w-6" />
      <span className="tracked-caps text-[14px] font-semibold text-foreground">
        GridFlex
      </span>
    </span>
  );
}
