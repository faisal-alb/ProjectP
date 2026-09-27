/** Remounts on every dashboard navigation, so each page settles in rather than swapping in place. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-settle">{children}</div>;
}
