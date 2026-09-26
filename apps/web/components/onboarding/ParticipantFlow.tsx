"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Battery,
  Building2,
  Car,
  Check,
  CircleHelp,
  Loader2,
  Snowflake,
  Sun,
  Wallet,
  Zap,
} from "lucide-react";
import { DEMO_HOUSEHOLD_RESOURCE_ID, demoDevices, estimateFlex, resolveZip, type ResourceKey } from "@gridflex/shared";
import { completeOnboarding } from "@/app/actions";
import { api, clusterLabel, shortAddress, useApiHealth, type HouseholdDto } from "@/lib/api";
import { defaultParticipantProfile, type Emergency, type ParticipantProfile } from "@/lib/profile";
import {
  ChoiceTile,
  Segmented,
  SelectField,
  SettingRow,
  SliderRow,
  Switch,
  TextField,
  primaryButton,
  secondaryButton,
} from "./controls";

const STEPS = ["Resources", "Limits", "Payout"] as const;

const RESOURCE_TILES: { key: ResourceKey; icon: typeof Battery; title: string; description: string }[] = [
  { key: "battery", icon: Battery, title: "Home battery", description: "Powerwall, Enphase, or similar" },
  { key: "ev", icon: Car, title: "EV / EV charger", description: "Charging that can wait" },
  { key: "solar", icon: Sun, title: "Solar", description: "Rooftop or ground-mounted" },
  { key: "hvac", icon: Snowflake, title: "HVAC / thermostat", description: "Cooling that can ease off" },
  { key: "generator", icon: Zap, title: "Generator", description: "Backup power" },
  { key: "building", icon: Building2, title: "Flexible building load", description: "Pumps, lighting, equipment" },
];

const READY_BY = ["05:00", "06:00", "06:30", "07:00", "07:30", "08:00", "09:00"].map((v) => {
  const [h, m] = v.split(":").map(Number);
  return { value: v, label: `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` };
});

const money = (n: number) => `$${n.toFixed(2)}`;

export function ParticipantFlow() {
  const [profile, setProfile] = useState<ParticipantProfile>(defaultParticipantProfile);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const patch = (next: Partial<ParticipantProfile>) => setProfile((p) => ({ ...p, ...next }));
  const location = resolveZip(profile.zip);
  const canContinue = step === 0 ? (profile.resources.length > 0 || profile.notSure) && location !== null : true;

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
      await completeOnboarding("participant", profile);
      setDone(true);
    } catch {
      setError("We couldn't save your setup. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) return <Ready profile={profile} heading={heading} zone={location?.zone ?? "Downtown"} feeder={location?.feeder ?? "DT-A"} />;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10 sm:py-14">
      <Progress step={step} />

      {step === 0 && (
        <ResourcesStep profile={profile} patch={patch} heading={heading} location={location} />
      )}
      {step === 1 && <LimitsStep profile={profile} patch={patch} heading={heading} />}
      {step === 2 && <PayoutStep heading={heading} />}

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
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className={primaryButton} disabled={saving} onClick={finish}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Setting up…" : "Finish setup"}
          </button>
        )}
      </div>
    </main>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((name, i) => (
          <span key={name} className={`h-1 flex-1 rounded-sm ${i <= step ? "bg-foreground" : "bg-white/[0.08]"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>
    </div>
  );
}

type StepProps = {
  profile: ParticipantProfile;
  patch: (next: Partial<ParticipantProfile>) => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
};

function ResourcesStep({ profile, patch, heading, location }: StepProps & { location: ReturnType<typeof resolveZip> }) {
  const toggle = (key: ResourceKey) => {
    const has = profile.resources.includes(key);
    patch({
      notSure: false,
      resources: has ? profile.resources.filter((k) => k !== key) : [...profile.resources, key],
    });
  };
  const zipComplete = profile.zip.length === 5;

  return (
    <section className="mt-8" aria-labelledby="resources-heading">
      <h1 id="resources-heading" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">
        What energy resources do you have?
      </h1>
      <p className="mt-2 text-sm text-muted">Pick everything that could help the grid. You can change this later.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-label="Energy resources">
        {RESOURCE_TILES.map(({ key, icon, title, description }) => (
          <ChoiceTile
            key={key}
            icon={icon}
            title={title}
            description={description}
            selected={profile.resources.includes(key)}
            onClick={() => toggle(key)}
          />
        ))}
        <div className="sm:col-span-2">
          <ChoiceTile
            icon={CircleHelp}
            title="Not sure yet"
            description="We'll connect your address now and help you add devices later."
            selected={profile.notSure}
            onClick={() => patch({ notSure: !profile.notSure, resources: [] })}
          />
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Where are they connected?</h2>
      <p className="mt-1 text-sm text-muted">
        GridFlex finds your local grid zone from your address. For this demo, your ZIP code is enough.
      </p>
      <div className="mt-4 max-w-[12rem]">
        <TextField
          label="ZIP code"
          value={profile.zip}
          onChange={(v) => patch({ zip: v.replace(/\D/g, "").slice(0, 5) })}
          inputMode="numeric"
          maxLength={5}
          mono
          invalid={zipComplete && !location}
        />
      </div>

      <div className="mt-4" aria-live="polite">
        {location ? (
          <div className="rounded-md border border-border bg-background-raised p-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">GridFlex zone</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {location.zone} <span className="font-mono text-muted tabular">/ {location.feeder}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Utility</dt>
                <dd className="mt-0.5 font-medium text-foreground">{location.utility}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm text-foreground">
              <Check className="h-4 w-4 text-normal" aria-hidden="true" />
              Eligible for local GridFlex events
            </p>
          </div>
        ) : (
          <p className={`text-xs ${zipComplete ? "text-watch" : "text-muted-2"}`}>
            {zipComplete
              ? "GridFlex isn't available at this ZIP yet. In the demo, try 33132."
              : "Enter a 5-digit ZIP. In the demo, try 33132."}
          </p>
        )}
      </div>
    </section>
  );
}

function LimitsStep({ profile, patch, heading }: StepProps) {
  const has = (key: ResourceKey) => profile.resources.includes(key);
  const battery = has("battery");
  const estimate = estimateFlex(profile);
  const anyResource = profile.resources.length > 0;

  return (
    <section className="mt-8" aria-labelledby="limits-heading">
      <h1 id="limits-heading" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">
        When can GridFlex use your flexibility?
      </h1>
      <p className="mt-2 text-sm text-muted">
        AutoFlex joins events for you, only inside the limits you set here. You never place bids.
      </p>

      {!anyResource ? (
        <div className="mt-6 rounded-md border border-border bg-background-raised p-4 text-sm text-muted">
          You haven&rsquo;t connected any devices yet, so there are no limits to set. You can add devices and AutoFlex
          limits from your dashboard whenever you&rsquo;re ready.
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-2" aria-label="Connected devices">
            {profile.resources.map((key) => (
              <li key={key} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-md border border-border px-3 py-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-normal" aria-hidden="true" />
                <span className="font-medium text-foreground">{demoDevices[key].device}</span>
                <span className="text-xs text-muted">{demoDevices[key].spec}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-2">Demo device</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 divide-y divide-border border-y border-border">
            <SettingRow label="AutoFlex" hint={profile.autoFlex ? "Joins events that match your limits" : "You'll approve each event yourself"}>
              <Switch checked={profile.autoFlex} onChange={(v) => patch({ autoFlex: v })} label="AutoFlex" />
            </SettingRow>
          </div>

          {battery && (
            <fieldset className="mt-8 space-y-6">
              <legend className="text-base font-semibold text-foreground">Battery</legend>
              <SliderRow
                label="Always keep at least"
                value={profile.reservePercent}
                display={`${profile.reservePercent}%`}
                min={20}
                max={80}
                step={5}
                onChange={(v) => patch({ reservePercent: v })}
                hint="Charge kept for your home, for example during an outage."
              />
              <SliderRow
                label="Share at most"
                value={profile.maxKwhPerEvent}
                display={`${profile.maxKwhPerEvent.toFixed(1)} kWh`}
                min={1}
                max={6}
                step={0.5}
                onChange={(v) => patch({ maxKwhPerEvent: v })}
                hint="Per event."
              />
            </fieldset>
          )}

          {has("ev") && (
            <fieldset className="mt-8 space-y-6">
              <legend className="text-base font-semibold text-foreground">Electric vehicle</legend>
              <SelectField
                label="Vehicle ready by"
                value={profile.ev.readyBy}
                options={READY_BY}
                onChange={(v) => patch({ ev: { ...profile.ev, readyBy: v } })}
              />
              <SliderRow
                label="Always have at least"
                value={profile.ev.minCharge}
                display={`${profile.ev.minCharge}%`}
                min={20}
                max={90}
                step={5}
                onChange={(v) => patch({ ev: { ...profile.ev, minCharge: v } })}
              />
              <SliderRow
                label="Delay charging by up to"
                value={profile.ev.delayMinutes}
                display={`${profile.ev.delayMinutes} min`}
                min={30}
                max={180}
                step={15}
                onChange={(v) => patch({ ev: { ...profile.ev, delayMinutes: v } })}
                hint="Delayed charging counts as flexibility."
              />
            </fieldset>
          )}

          {has("hvac") && (
            <fieldset className="mt-8 space-y-6">
              <legend className="text-base font-semibold text-foreground">HVAC</legend>
              <SliderRow
                label="Maximum adjustment"
                value={profile.hvac.maxAdjustF}
                display={`${profile.hvac.maxAdjustF}°F`}
                min={1}
                max={4}
                step={1}
                onChange={(v) => patch({ hvac: { ...profile.hvac, maxAdjustF: v } })}
              />
              <SliderRow
                label="Maximum event duration"
                value={profile.hvac.maxMinutes}
                display={`${profile.hvac.maxMinutes} min`}
                min={30}
                max={120}
                step={15}
                onChange={(v) => patch({ hvac: { ...profile.hvac, maxMinutes: v } })}
              />
            </fieldset>
          )}

          <fieldset className="mt-8">
            <legend className="text-base font-semibold text-foreground">Every event</legend>
            <div className="mt-4 space-y-6">
              <SliderRow
                label="Only join when paid at least"
                value={profile.minRate}
                display={`${money(profile.minRate)}/kWh`}
                min={0.05}
                max={0.3}
                step={0.01}
                onChange={(v) => patch({ minRate: Math.round(v * 100) / 100 })}
              />
            </div>
            <div className="mt-2 divide-y divide-border">
              <SettingRow label="Most events per day">
                <Segmented
                  label="Most events per day"
                  value={profile.maxEventsPerDay}
                  options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
                  onChange={(v) => patch({ maxEventsPerDay: v })}
                />
              </SettingRow>
              <SettingRow label="Emergency events" hint="When the grid is at risk of an outage">
                <Segmented<Emergency>
                  label="Emergency events"
                  value={profile.emergency}
                  options={[
                    { value: "ask", label: "Ask me" },
                    { value: "allow", label: "Allow" },
                    { value: "never", label: "Never" },
                  ]}
                  onChange={(v) => patch({ emergency: v })}
                />
              </SettingRow>
            </div>
          </fieldset>

          <p className="mt-8 rounded-md border border-border bg-background-raised px-4 py-3 text-sm text-foreground" aria-live="polite">
            {estimate.batteryKwh > 0 || has("ev") ? (
              <>
                With these limits, one event could use up to{" "}
                <strong className="font-semibold">
                  {(estimate.batteryKwh + (has("ev") ? 7.2 : 0)).toFixed(1)} kWh
                </strong>
                , worth about{" "}
                <strong className="font-semibold">
                  {money(estimate.earningsLow)}–{money(estimate.earningsHigh)}
                </strong>
                .
              </>
            ) : (
              "Lower your reserve to share energy from your battery."
            )}
          </p>
          <p className="mt-3 text-xs text-muted">
            GridFlex will never intentionally use your resources beyond these limits.
          </p>
        </>
      )}
    </section>
  );
}

function PayoutStep({ heading }: { heading: React.RefObject<HTMLHeadingElement | null> }) {
  const { status, health } = useApiHealth();
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "online") return;
    let cancelled = false;
    api<HouseholdDto>(`/households/${DEMO_HOUSEHOLD_RESOURCE_ID}`)
      .then((h) => !cancelled && setWallet(h.wallet))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <section className="mt-8" aria-labelledby="payout-heading">
      <h1 id="payout-heading" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">
        How do you want to get paid?
      </h1>
      <p className="mt-2 text-sm text-muted">
        Payments are made in USDC on Solana as soon as your meter confirms what you shared.
      </p>

      <div className="mt-6 space-y-3" role="radiogroup" aria-label="Payout method">
        <ChoiceTile
          radio
          icon={Wallet}
          title="GridFlex wallet"
          description="We create and hold a USDC wallet for you. Nothing to install, and you can withdraw later."
          selected
          onClick={() => {}}
        />
        <ChoiceTile
          radio
          icon={Wallet}
          title="Connect my own Solana wallet"
          description="Phantom, Solflare, and others. Coming soon."
          selected={false}
          disabled
          onClick={() => {}}
        />
      </div>

      <div className="mt-6 rounded-md border border-border bg-background-raised p-4 text-sm" aria-live="polite">
        {wallet ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground">
            <Check className="h-4 w-4 text-normal" aria-hidden="true" />
            <span className="font-medium">Wallet ready</span>
            <span className="font-mono text-muted tabular">{shortAddress(wallet)}</span>
            {health && <span className="text-xs text-muted-2">· {clusterLabel(health.cluster)} test USDC</span>}
          </p>
        ) : (
          <p className="text-muted">
            {status === "loading"
              ? "Checking the settlement service…"
              : "Your wallet is created when you finish. (The settlement service is offline, so this is a preview.)"}
          </p>
        )}
      </div>
    </section>
  );
}

function Ready({
  profile,
  heading,
  zone,
  feeder,
}: {
  profile: ParticipantProfile;
  heading: React.RefObject<HTMLHeadingElement | null>;
  zone: string;
  feeder: string;
}) {
  const estimate = estimateFlex(profile);
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10 sm:py-14">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-foreground outline-none">
        You&rsquo;re ready
      </h1>
      <p className="mt-2 text-sm text-muted">
        Here&rsquo;s what GridFlex can use from you today, inside your limits.
      </p>

      <dl className="panel mt-8 divide-y divide-border rounded-lg">
        {estimate.offers.length === 0 ? (
          <div className="px-5 py-4">
            <dt className="text-sm font-medium text-foreground">Available flexibility</dt>
            <dd className="mt-1 text-sm text-muted">Nothing connected yet. Add devices from your dashboard.</dd>
          </div>
        ) : (
          estimate.offers.map((o) => (
            <div key={o.key} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
              <dt className="text-sm text-muted">{o.label}</dt>
              <dd className="font-mono text-sm font-semibold tabular text-foreground">{o.value}</dd>
            </div>
          ))
        )}
        <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
          <dt className="text-sm text-muted">Grid zone</dt>
          <dd className="text-sm font-semibold text-foreground">
            {zone} <span className="font-mono text-muted tabular">/ {feeder}</span>
          </dd>
        </div>
        {estimate.offers.length > 0 && (
          <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
            <dt className="text-sm text-muted">Potential earnings per event</dt>
            <dd className="font-mono text-sm font-semibold tabular text-accent">
              {money(estimate.earningsLow)}–{money(estimate.earningsHigh)}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted-2">Demo estimate, based on your limits and illustrative event rates.</p>

      <Link href="/dashboard" className={`${primaryButton} mt-8`}>
        Go to My Energy
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </main>
  );
}
