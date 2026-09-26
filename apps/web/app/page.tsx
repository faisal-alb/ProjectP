import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  ClipboardList,
  Workflow,
  ShieldCheck,
  HandCoins,
  Sun,
  Battery,
  Clock,
  TrendingDown,
  Zap,
} from "lucide-react";

import { Navbar } from "@/components/gridflex/Navbar";
import { HeroGridPreview } from "@/components/gridflex/HeroGridPreview";
import { SectionHeader } from "@/components/gridflex/SectionHeader";
import { WorkflowStep } from "@/components/gridflex/WorkflowStep";
import { FlexResourceCard } from "@/components/gridflex/FlexResourceCard";
import { GridIntelligencePanel } from "@/components/gridflex/GridIntelligencePanel";
import { GridMapPreview } from "@/components/gridflex/GridMapPreview";
import { MarketTable } from "@/components/gridflex/MarketTable";
import {
  ParticipantEnergyCard,
  AutoFlexCard,
} from "@/components/gridflex/ParticipantEnergyCard";
import {
  SolanaSettlementCard,
  SettlementFlow,
} from "@/components/gridflex/SolanaSettlementCard";
import { ProblemSplit } from "@/components/gridflex/ProblemSplit";
import { MicrogridFlow } from "@/components/gridflex/MicrogridFlow";
import { CTASection } from "@/components/gridflex/CTASection";
import { Footer } from "@/components/gridflex/Footer";
import { FadeIn } from "@/components/gridflex/FadeIn";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      {/* HERO */}
      <section className="mx-auto w-full max-w-[1200px] px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-bright" />
              AI-assisted grid flexibility infrastructure
            </span>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
              Prevent grid congestion
              <br />
              before it becomes an outage.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              GridFlex predicts local electricity constraints and coordinates
              batteries, EVs, buildings, solar, and generators to provide
              flexibility exactly where the grid needs it.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Launch Grid Demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-black/[.03]"
              >
                See How It Works
              </a>
            </div>

            <p className="mt-6 text-sm text-muted">
              Predictive grid intelligence · Local flexibility markets ·
              Solana settlement
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroGridPreview />
          </div>
        </div>
      </section>

      {/* CATEGORY STRIP */}
      <section className="border-y border-border bg-white/60">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-5 py-8 sm:px-8">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Built for
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              "Utilities",
              "Microgrids",
              "Cities",
              "EV fleets",
              "Energy communities",
            ].map((item) => (
              <span
                key={item}
                className="text-sm font-medium text-foreground/70"
              >
                {item}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted">Powered by Solana</p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <FadeIn>
          <SectionHeader
            title="The grid has capacity. It just isn't coordinated."
            subtitle={
              <>
                As electricity demand grows, local grids increasingly face
                short periods where demand approaches the limits of
                transformers, feeders, or distribution zones.
                <br />
                <br />
                At the same time, batteries, EVs, solar systems, generators,
                and flexible loads may already exist nearby.
              </>
            }
          />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <ProblemSplit />
        </FadeIn>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <FadeIn>
          <SectionHeader
            eyebrow="Workflow"
            title="From prediction to settlement."
            subtitle="GridFlex turns a forecasted grid constraint into coordinated local action."
          />
        </FadeIn>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <FadeIn>
            <WorkflowStep
              index={1}
              icon={TrendingUp}
              title="Predict"
              description="GridFlex analyzes load, weather, time-of-day, events, and distributed capacity to identify upcoming grid constraints."
            >
              <dl className="space-y-1.5 rounded-lg bg-soft px-3 py-2.5 text-xs">
                <Row label="Forecast" value="12.8 MW" />
                <Row label="Capacity" value="12.0 MW" />
                <Row label="Risk" value="91%" accent />
              </dl>
            </WorkflowStep>
          </FadeIn>

          <FadeIn delay={80}>
            <WorkflowStep
              index={2}
              icon={ClipboardList}
              title="Procure"
              description="The utility opens a local flexibility request for the amount of grid relief required."
            >
              <dl className="space-y-1.5 rounded-lg bg-soft px-3 py-2.5 text-xs">
                <Row label="Zone" value="Downtown" />
                <Row label="Need" value="800 kW" accent />
                <Row label="Window" value="7:00–8:00 PM" />
              </dl>
            </WorkflowStep>
          </FadeIn>

          <FadeIn delay={160}>
            <WorkflowStep
              index={3}
              icon={Workflow}
              title="Coordinate"
              description="GridFlex selects nearby batteries, EVs, buildings, solar systems, and generators based on availability, location, and price."
            >
              <dl className="space-y-1.5 rounded-lg bg-soft px-3 py-2.5 text-xs">
                <Row label="Battery" value="300 kW" />
                <Row label="EV shift" value="180 kW" />
                <Row label="HVAC" value="170 kW" />
              </dl>
            </WorkflowStep>
          </FadeIn>

          <FadeIn delay={240}>
            <WorkflowStep
              index={4}
              icon={ShieldCheck}
              title="Verify"
              description="Meter or device data confirms how much flexibility each participant actually delivered."
            >
              <dl className="space-y-1.5 rounded-lg bg-soft px-3 py-2.5 text-xs">
                <Row label="Committed" value="800 kW" />
                <Row label="Delivered" value="806 kW" accent />
              </dl>
            </WorkflowStep>
          </FadeIn>

          <FadeIn delay={320}>
            <WorkflowStep
              index={5}
              icon={HandCoins}
              title="Settle"
              description="Verified commitments and payments are recorded through Solana for transparent, programmable settlement."
            >
              <div className="flex items-center gap-2 rounded-lg bg-soft px-3 py-2.5 text-xs font-medium text-primary">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Recorded on Solana
              </div>
            </WorkflowStep>
          </FadeIn>
        </div>
      </section>

      {/* WHAT COUNTS AS FLEXIBILITY */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <FadeIn>
          <SectionHeader
            title="The grid doesn't only need more generation. It needs flexibility."
          />
        </FadeIn>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FadeIn>
            <FlexResourceCard
              icon={Sun}
              title="Generate"
              examples={["Solar", "Generators", "Microgrids"]}
              description="Export additional power during constrained periods."
            />
          </FadeIn>
          <FadeIn delay={80}>
            <FlexResourceCard
              icon={Battery}
              title="Store"
              examples={["Home batteries", "Commercial storage", "Vehicle-to-grid"]}
              description="Release stored energy when local demand is highest."
            />
          </FadeIn>
          <FadeIn delay={160}>
            <FlexResourceCard
              icon={Clock}
              title="Shift"
              examples={["EV charging", "HVAC", "Water heating", "Industrial demand"]}
              description="Move electricity use away from congested periods."
            />
          </FadeIn>
          <FadeIn delay={240}>
            <FlexResourceCard
              icon={TrendingDown}
              title="Reduce"
              examples={["Commercial loads", "Buildings", "Industrial equipment"]}
              description="Temporarily reduce consumption in exchange for compensation."
            />
          </FadeIn>
        </div>
      </section>

      {/* GRID INTELLIGENCE (dark) */}
      <section
        id="technology"
        className="scroll-mt-20 bg-dark py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <FadeIn>
            <SectionHeader
              dark
              eyebrow="Forecasting + operational intelligence"
              title="Grid intelligence that explains what happens next."
              subtitle="GridFlex combines operational signals with contextual data to identify where local capacity may become constrained and how much flexibility is required."
            />
          </FadeIn>
          <FadeIn delay={100} className="mt-10">
            <GridIntelligencePanel />
          </FadeIn>
        </div>
      </section>

      {/* LOCAL MARKETS */}
      <section
        id="network"
        className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <FadeIn>
          <SectionHeader
            eyebrow="Local markets"
            title="Grid constraints are local. Flexibility should be too."
            subtitle="A battery hundreds of miles away cannot relieve an overloaded neighborhood feeder. GridFlex matches flexibility to the specific zone where capacity is needed."
          />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <GridMapPreview />
        </FadeIn>
      </section>

      {/* WHY SOLANA */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <FadeIn>
          <SectionHeader
            eyebrow="Settlement layer"
            title="Transparent settlement for a distributed grid."
            subtitle="GridFlex keeps high-frequency grid telemetry and forecasting off-chain while using Solana for the parts that benefit from a shared, auditable ledger."
          />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <SolanaSettlementCard />
        </FadeIn>
        <FadeIn delay={160} className="mx-auto mt-8 max-w-sm">
          <SettlementFlow />
        </FadeIn>
      </section>

      {/* MICROGRID USE CASE */}
      <section
        id="about"
        className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <FadeIn>
          <SectionHeader
            eyebrow="Beyond the grid edge"
            title="Useful wherever electricity is fragmented."
            subtitle="In regions with unreliable utility supply, electricity may come from a mixture of the grid, rooftop solar, batteries, diesel generators, and neighborhood microgrids. GridFlex can coordinate those resources instead of treating each one as an isolated backup system."
          />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <MicrogridFlow />
        </FadeIn>
      </section>

      {/* PARTICIPANT EXPERIENCE */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <FadeIn>
          <SectionHeader title="Anyone with flexible energy can participate." />
        </FadeIn>
        <div className="mt-10 grid max-w-2xl gap-5 sm:grid-cols-2">
          <FadeIn>
            <ParticipantEnergyCard />
          </FadeIn>
          <FadeIn delay={80}>
            <AutoFlexCard />
          </FadeIn>
        </div>
      </section>

      {/* LIVE MARKET */}
      <section className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
        <FadeIn>
          <SectionHeader title="When the grid needs help, the market responds." />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <MarketTable />
        </FadeIn>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto w-full max-w-[1200px] px-5 pb-20 sm:px-8 sm:pb-28">
        <FadeIn>
          <CTASection />
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`font-mono font-medium ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}
