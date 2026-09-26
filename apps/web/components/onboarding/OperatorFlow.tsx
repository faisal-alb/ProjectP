"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { demoNetworkFeeders, downtown, zones } from "@gridflex/shared";
import { completeOnboarding } from "@/app/actions";
import { clusterLabel, useApiHealth } from "@/lib/api";
import { defaultOperatorProfile, type OperatorProfile, type OrgType, type Strategy } from "@/lib/profile";
import {
  ChoiceTile,
  SelectField,
  SettingRow,
  SliderRow,
  Switch,
  TextField,
  primaryButton,
  secondaryButton,
} from "./controls";

const STEPS = [
  { name: "Organization", detail: "Who you are" },
  { name: "Network", detail: "What you operate" },
  { name: "Rules", detail: "How GridFlex procures" },
] as const;

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: "utility", label: "Utility" },
  { value: "municipality", label: "Municipality" },
  { value: "microgrid", label: "Microgrid" },
  { value: "campus", label: "Campus" },
  { value: "aggregator", label: "Energy aggregator" },
  { value: "commercial", label: "Commercial operator" },
];

const STRATEGIES: { value: Strategy; title: string; description: string }[] = [
  { value: "balanced", title: "Balanced", description: "Weigh cost, reliability, and carbon together." },
  { value: "cost", title: "Lowest cost", description: "Cheapest offers first." },
  { value: "carbon", title: "Lowest carbon", description: "Prefer clean and stored energy." },
  { value: "reliability", title: "Highest reliability", description: "Prefer resources with the best delivery record." },
];

const price = (n: number) => `$${n.toFixed(2)}/kWh`;

export function OperatorFlow() {
  const [profile, setProfile] = useState<OperatorProfile>(defaultOperatorProfile);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const patch = (next: Partial<OperatorProfile>) => setProfile((p) => ({ ...p, ...next }));

  const canContinue = step === 0 ? profile.orgName.trim().length > 0 && profile.region.trim().length > 0 : true;

  // Move focus to the new heading when the step changes, not on first load.
  const lastStep = useRef(`${step}-${done}`);
  useEffect(() => {
    const key = `${step}-${done}`;
    if (lastStep.current === key) return;
    lastStep.current = key;
    heading.current?.focus();
  }, [step, done]);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding("operator", profile);
      setDone(true);
    } catch {
      setError("We couldn't save your configuration. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) return <Ready profile={profile} heading={heading} />;

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="Setup steps" className="lg:pt-1">
        <ol className="flex gap-2 lg:flex-col lg:gap-0">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "current" : "upcoming";
            return (
              <li key={s.name} className="min-w-0 flex-1 lg:flex-none" aria-current={state === "current" ? "step" : undefined}>
                <div className="flex items-start gap-3 lg:py-3">
                  <span
                    className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded-sm border font-mono text-xs tabular lg:flex ${
                      state === "done"
                        ? "border-normal/50 text-normal"
                        : state === "current"
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-2"
                    }`}
                  >
                    {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${state === "upcoming" ? "text-muted-2" : "text-foreground"}`}>
                      {s.name}
                    </p>
                    <p className="hidden text-xs text-muted-2 lg:block">{s.detail}</p>
                  </div>
                </div>
                <span
                  className={`mt-2 block h-0.5 rounded-sm lg:hidden ${state === "upcoming" ? "bg-white/[0.08]" : "bg-foreground"}`}
                  aria-hidden="true"
                />
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0">
        {step === 0 && <OrgStep profile={profile} patch={patch} heading={heading} />}
        {step === 1 && <NetworkStep profile={profile} patch={patch} heading={heading} />}
        {step === 2 && <RulesStep profile={profile} patch={patch} heading={heading} />}

        {error && (
          <p role="alert" className="mt-6 rounded-md border border-risk/40 px-3 py-2 text-sm text-foreground">
            {error}
          </p>
        )}

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
          {step > 0 ? (
            <button type="button" className={secondaryButton} onClick={() => setStep(step - 1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          ) : (
            <Link href="/onboarding" className={secondaryButton}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className={primaryButton} disabled={!canContinue} onClick={() => setStep(step + 1)}>
              {step === 1 ? "Continue with demo data" : "Continue"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={primaryButton} disabled={saving} onClick={finish}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Configuring…" : "Finish configuration"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

type StepProps = {
  profile: OperatorProfile;
  patch: (next: Partial<OperatorProfile>) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
};

function StepHeading({
  heading,
  id,
  title,
  children,
}: {
  heading: React.RefObject<HTMLHeadingElement | null>;
  id: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <h1 id={id} ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">
        {title}
      </h1>
      {children && <p className="mt-2 max-w-xl text-sm text-muted">{children}</p>}
    </>
  );
}

function OrgStep({ profile, patch, heading }: StepProps) {
  return (
    <section aria-labelledby="org-heading">
      <StepHeading heading={heading} id="org-heading" title="Tell us about your energy network">
        This names your workspace and sets regional defaults.
      </StepHeading>
      <div className="mt-8 grid max-w-xl gap-5">
        <TextField
          label="Organization name"
          value={profile.orgName}
          onChange={(v) => patch({ orgName: v.slice(0, 60) })}
          placeholder="Demo Energy"
        />
        <SelectField
          label="Organization type"
          value={profile.orgType}
          options={ORG_TYPES}
          onChange={(v) => patch({ orgType: v })}
        />
        <TextField
          label="Primary region"
          value={profile.region}
          onChange={(v) => patch({ region: v.slice(0, 60) })}
          placeholder="South Florida"
          hint="State, territory, or service area."
        />
      </div>
    </section>
  );
}

function NetworkStep({ profile, patch, heading }: StepProps) {
  return (
    <section aria-labelledby="network-heading">
      <StepHeading heading={heading} id="network-heading" title="Set up your grid topology">
        GridFlex matches flexibility to the zone that needs it, so it needs to know your substations, feeders, and their
        limits.
      </StepHeading>

      <div className="mt-6 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="How to start">
        <ChoiceTile radio selected title="GridFlex demo network" description="Pre-built, with limits filled in." onClick={() => {}} />
        <ChoiceTile radio selected={false} disabled title="Import network data" description="Coming soon." onClick={() => {}} />
        <ChoiceTile radio selected={false} disabled title="Create manually" description="Coming soon." onClick={() => {}} />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-foreground">South Florida demo grid</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Substations, feeders, and safe capacity in the demo network</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="pb-2 pr-3 font-medium">Substation</th>
              <th scope="col" className="pb-2 pr-3 font-medium">Feeders</th>
              <th scope="col" className="pb-2 pr-3 text-right font-medium">Safe capacity</th>
              <th scope="col" className="pb-2 text-right font-medium">Load now</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.name} className="border-t border-border">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium text-foreground">{zone.name}</th>
                <td className="py-2.5 pr-3 font-mono text-xs text-muted">
                  {(demoNetworkFeeders[zone.name] ?? []).join(" · ")}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground">{zone.capacityMw.toFixed(1)} MW</td>
                <td className="py-2.5 text-right font-mono whitespace-nowrap tabular text-foreground/85">{zone.currentMw.toFixed(1)} MW</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid max-w-xl gap-6">
        <SliderRow
          label="Warning threshold"
          value={profile.warningPercent}
          display={`${profile.warningPercent}% of capacity`}
          min={60}
          max={95}
          step={5}
          onChange={(v) => patch({ warningPercent: v })}
          hint="Zones above this are flagged as close to their limit. At 100% they need flexibility."
        />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Where GridFlex gets its data</h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {["Grid simulator", "Weather feed", "Demo resource network"].map((name) => (
          <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <Check className="h-4 w-4 text-normal" aria-hidden="true" />
              {name}
            </span>
            <span className="text-xs text-muted">Connected</span>
          </li>
        ))}
        {["SCADA", "Smart meters (AMI)", "DERMS", "Building systems", "EV networks"].map((name) => (
          <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm text-muted-2">
            <span>{name}</span>
            <span className="text-xs">After the demo</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RulesStep({ profile, patch, heading }: StepProps) {
  const { status, health } = useApiHealth();
  return (
    <section aria-labelledby="rules-heading">
      <StepHeading heading={heading} id="rules-heading" title="How should GridFlex procure flexibility?">
        These are your defaults. You can change them on any request.
      </StepHeading>

      <fieldset className="mt-6">
        <legend className="text-base font-semibold text-foreground">Procurement strategy</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Procurement strategy">
          {STRATEGIES.map((s) => (
            <ChoiceTile
              key={s.value}
              radio
              selected={profile.strategy === s.value}
              title={s.title}
              description={s.description}
              onClick={() => patch({ strategy: s.value })}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-8 grid max-w-xl gap-6">
        <SliderRow
          label="Maximum normal event price"
          value={profile.maxNormalPrice}
          display={price(profile.maxNormalPrice)}
          min={0.05}
          max={0.4}
          step={0.01}
          onChange={(v) => patch({ maxNormalPrice: Math.round(v * 100) / 100 })}
          hint="The most you'll pay for an ordinary request. It sets how much USDC is locked in escrow."
        />
        <SliderRow
          label="Maximum emergency price"
          value={profile.maxEmergencyPrice}
          display={price(profile.maxEmergencyPrice)}
          min={0.2}
          max={1}
          step={0.05}
          onChange={(v) => patch({ maxEmergencyPrice: Math.round(v * 100) / 100 })}
        />
        <SliderRow
          label="Recommend a request when congestion risk reaches"
          value={profile.minRiskPercent}
          display={`${profile.minRiskPercent}%`}
          min={50}
          max={95}
          step={5}
          onChange={(v) => patch({ minRiskPercent: v })}
        />
      </div>

      <div className="mt-4 max-w-xl divide-y divide-border border-y border-border">
        <SettingRow label="Recommend requests automatically" hint="GridFlex flags a constraint and proposes the fix.">
          <Switch checked={profile.autoRecommend} onChange={(v) => patch({ autoRecommend: v })} label="Recommend requests automatically" />
        </SettingRow>
        <SettingRow label="Launch requests automatically" hint="Off means you approve and fund each one.">
          <Switch checked={profile.autoLaunch} onChange={(v) => patch({ autoLaunch: v })} label="Launch requests automatically" />
        </SettingRow>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Settlement</h2>
      <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted">Network</dt>
          <dd className="text-foreground">
            Solana {status === "online" && health ? clusterLabel(health.cluster) : "devnet"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted">Asset</dt>
          <dd className="text-foreground">Test USDC (a stand-in for USDC)</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted">Funding wallet</dt>
          <dd className="text-foreground">Connected when you open a request</dd>
        </div>
      </dl>
    </section>
  );
}

function Ready({ profile, heading }: { profile: OperatorProfile; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const feeders = Object.values(demoNetworkFeeders).flat().length;
  const atRisk = zones.filter((z) => z.status === "high").length;
  const rows: [string, string][] = [
    ["Substations connected", String(zones.length)],
    ["Feeders", String(feeders)],
    ["Grid health", atRisk > 0 ? `${atRisk} ${atRisk === 1 ? "zone needs" : "zones need"} flexibility` : "Normal"],
    ["Nearby flexibility", `${downtown.flexAvailableMw.toFixed(1)} MW`],
    ["Next predicted constraint", `${downtown.zone} · ${downtown.peakTime}`],
  ];
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10 sm:py-14">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-foreground outline-none">
        {profile.orgName}&rsquo;s network is ready
      </h1>
      <p className="mt-2 text-sm text-muted">GridFlex is watching your demo network and will flag constraints as they form.</p>

      <dl className="panel mt-8 divide-y divide-border rounded-lg">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-right text-sm font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-2">Demo network. All figures are illustrative.</p>

      <Link href="/dashboard" className={`${primaryButton} mt-8`}>
        Open control center
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </main>
  );
}
