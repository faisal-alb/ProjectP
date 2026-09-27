/** The title row every dashboard page opens with. Extra controls sit on the right. */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.022em] text-foreground sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-4">{children}</div>}
    </div>
  );
}
