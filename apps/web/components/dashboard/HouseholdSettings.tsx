"use client";

import { Check } from "lucide-react";
import { Segmented, SelectField, SliderRow, Switch } from "@/components/onboarding/controls";
import { useHouseholdState } from "./HouseholdState";
import { PageHeader } from "./PageHeader";
import { InfoTip } from "@/components/ui/Tooltip";
import { READY_BY } from "@/lib/profile";
import type { SaveStatus } from "./HouseholdState";

const price = (n: number) => `$${n.toFixed(2)}/kWh`;

const SAVE_NOTE: Record<SaveStatus, string> = {
  idle: "Changes save automatically and apply to tonight and future events.",
  saving: "Saving…",
  saved: "Saved. Applies to tonight and future events.",
  error: "Couldn't save your changes. They apply to this visit only.",
};

/** AutoFlex and the limits it works within. On its own page, so the controls are always open. */
export function HouseholdSettings() {
  const { rules, setRules, rate, resources, saveStatus } = useHouseholdState();

  return (
    <div>
      <PageHeader title="Settings" subtitle="The rules GridFlex follows when it uses your energy." />

      <section id="voice-autoflex" aria-labelledby="autoflex-heading" className="panel mt-6 max-w-2xl rounded-lg p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 id="autoflex-heading" className="tracked-caps text-xs font-medium text-muted">
                AutoFlex
              </h2>
              <InfoTip label="AutoFlex" side="bottom">
                Lets GridFlex join grid events for you, only inside the limits below. You never place bids.
              </InfoTip>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold text-foreground">
              {rules.autoFlex ? (
                <>
                  Enabled <Check className="h-4 w-4 text-normal" aria-hidden="true" />
                </>
              ) : (
                "Off"
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {rules.autoFlex ? "Joins events for you when they match the limits below." : "You decide on each event yourself."}
            </p>
          </div>
          <Switch checked={rules.autoFlex} onChange={(v) => setRules((r) => ({ ...r, autoFlex: v }))} label="AutoFlex" />
        </div>

        <div className="mt-6 space-y-6 border-t border-border pt-6">
          <SliderRow
            label="Always keep at least"
            value={rules.reserve}
            display={`${rules.reserve}%`}
            min={20}
            max={80}
            step={5}
            onChange={(v) => setRules((r) => ({ ...r, reserve: v }))}
            hint={`Charge kept for your home, for example during an outage. GridFlex never takes your battery below ${rules.reserve}%.`}
          />
          <SliderRow
            label="Only join when paid at least"
            value={rules.minRate}
            display={price(rules.minRate)}
            min={0.05}
            max={0.3}
            step={0.01}
            onChange={(v) => setRules((r) => ({ ...r, minRate: Math.round(v * 100) / 100 }))}
            hint={`Tonight pays ${price(rate)}.`}
          />
          <SliderRow
            label="Share at most"
            value={rules.maxKwh}
            display={`${rules.maxKwh.toFixed(1)} kWh`}
            min={1}
            max={6}
            step={0.5}
            onChange={(v) => setRules((r) => ({ ...r, maxKwh: v }))}
            hint="Per event."
          />
          <SliderRow
            label="Events per day"
            value={rules.maxEvents}
            display={`${rules.maxEvents}`}
            min={1}
            max={3}
            step={1}
            onChange={(v) => setRules((r) => ({ ...r, maxEvents: v }))}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Emergency dispatch</p>
            <Segmented
              label="Emergency dispatch"
              value={rules.emergency}
              options={[
                { value: "ask", label: "Ask me" },
                { value: "allow", label: "Automatic" },
                { value: "never", label: "Never" },
              ]}
              onChange={(v) => setRules((r) => ({ ...r, emergency: v }))}
            />
          </div>

          {resources.includes("ev") && (
            <div className="space-y-6 border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-foreground">Electric vehicle</h3>
              <SelectField
                label="Vehicle ready by"
                value={rules.ev.readyBy}
                options={READY_BY}
                onChange={(v) => setRules((r) => ({ ...r, ev: { ...r.ev, readyBy: v } }))}
              />
              <SliderRow
                label="Always have at least"
                value={rules.ev.minCharge}
                display={`${rules.ev.minCharge}%`}
                min={20}
                max={90}
                step={5}
                onChange={(v) => setRules((r) => ({ ...r, ev: { ...r.ev, minCharge: v } }))}
              />
              <SliderRow
                label="Delay charging by up to"
                value={rules.ev.delayMinutes}
                display={`${rules.ev.delayMinutes} min`}
                min={30}
                max={180}
                step={15}
                onChange={(v) => setRules((r) => ({ ...r, ev: { ...r.ev, delayMinutes: v } }))}
                hint="Delayed charging counts as flexibility."
              />
            </div>
          )}

          {resources.includes("hvac") && (
            <div className="space-y-6 border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-foreground">HVAC</h3>
              <SliderRow
                label="Maximum adjustment"
                value={rules.hvac.maxAdjustF}
                display={`${rules.hvac.maxAdjustF}°F`}
                min={1}
                max={4}
                step={1}
                onChange={(v) => setRules((r) => ({ ...r, hvac: { ...r.hvac, maxAdjustF: v } }))}
              />
              <SliderRow
                label="Maximum event duration"
                value={rules.hvac.maxMinutes}
                display={`${rules.hvac.maxMinutes} min`}
                min={30}
                max={120}
                step={15}
                onChange={(v) => setRules((r) => ({ ...r, hvac: { ...r.hvac, maxMinutes: v } }))}
              />
            </div>
          )}

          <p className="text-xs text-muted-2" role="status" aria-live="polite">
            {SAVE_NOTE[saveStatus]}
          </p>
        </div>
      </section>
    </div>
  );
}
