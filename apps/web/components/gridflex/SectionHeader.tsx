export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left",
  dark = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      {eyebrow && (
        <p
          className={`mb-3 text-sm font-medium tracking-wide uppercase ${
            dark ? "text-bright" : "text-primary"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`text-3xl font-semibold tracking-tight text-balance sm:text-4xl ${
          dark ? "text-white" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 text-base leading-relaxed sm:text-lg ${
            dark ? "text-dark-muted" : "text-muted"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
