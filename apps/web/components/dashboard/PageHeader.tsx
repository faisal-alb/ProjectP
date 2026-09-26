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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-4">{children}</div>}
    </div>
  );
}
