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
import { HeroHorizon } from "@/components/gridflex/HeroHorizon";
import { HeroConsole } from "@/components/gridflex/HeroConsole";
import { SectionHeader } from "@/components/gridflex/SectionHeader";
import { WorkflowRail, WorkflowReadout } from "@/components/gridflex/WorkflowStep";
import { FlexInstrumentPanel } from "@/components/gridflex/FlexResourceCard";
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

const workflowSteps = [
  {
    icon: TrendingUp,
    title: "Predict",
    description:
      "GridFlex analyzes load, weather, time-of-day, events, and distributed capacity to identify upcoming grid constraints.",
    readout: (
      <WorkflowReadout
        rows={[
          { label: "Forecast", value: "12.8 MW" },
          { label: "Capacity", value: "12.0 MW" },
          { label: "Risk", value: "91%", accent: true },
        ]}
      />
    ),
  },
  {
    icon: ClipboardList,
    title: "Procure",
    description:
      "The utility opens a local flexibility request for the amount of grid relief required.",
    readout: (
      <WorkflowReadout
        rows={[
          { label: "Zone", value: "Downtown Austin" },
          { label: "Need", value: "800 kW", accent: true },
          { label: "Window", value: "7:00–8:00 PM" },
        ]}
      />
    ),
  },
  {
    icon: Workflow,
    title: "Coordinate",
    description:
      "GridFlex selects nearby batteries, EVs, buildings, solar systems, and generators based on availability, location, and price.",
    readout: (
      <WorkflowReadout
        rows={[
          { label: "Battery", value: "300 kW" },
          { label: "EV shift", value: "180 kW" },
          { label: "HVAC", value: "170 kW" },
        ]}
      />
    ),
  },
  {
    icon: ShieldCheck,
    title: "Verify",
    description:
      "Meter or device data confirms how much flexibility each participant actually delivered.",
    readout: (
      <WorkflowReadout
        rows={[
          { label: "Committed", value: "800 kW" },
          { label: "Delivered", value: "806 kW", accent: true },
        ]}
      />
    ),
  },
  {
    icon: HandCoins,
    title: "Settle",
    description:
      "Verified commitments and payments are recorded through Solana for transparent, programmable settlement.",
    readout: (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background-raised px-3 py-2.5 text-xs font-medium text-foreground/85">
        <Zap className="h-3.5 w-3.5 text-solana-purple" aria-hidden="true" />
        Recorded on Solana
      </div>
    ),
  },
];

export default function Home() {
  return (
    <div className="home flex flex-1 flex-col">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden pb-10 sm:pb-16">
        <HeroHorizon className="pointer-events-none absolute inset-x-0 top-0 h-[300px] w-full sm:h-[400px] lg:h-[460px]" />

        <div className="relative mx-auto w-full max-w-[1240px] px-5 pt-[190px] sm:px-8 sm:pt-[250px] lg:pt-[290px]">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="rise text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-5xl lg:text-[3.5rem]">
              Prevent grid congestion{" "}
              <br className="hidden sm:block" />
              <span className="text-volt-gradient">before</span> it becomes an
              outage.
            </h1>

            <p
              className="rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-balance text-muted sm:text-lg"
              style={{ "--rise-delay": "80ms" } as React.CSSProperties}
            >
              GridFlex forecasts where a local feeder will run out of capacity,
              then coordinates nearby batteries, EVs, buildings, solar and
              generators to relieve it, with every verified kilowatt settled on
              Solana.
            </p>

            <div
              className="rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
              style={{ "--rise-delay": "160ms" } as React.CSSProperties}
            >
              <Link
                href="/dashboard"
                className="btn-volt inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                Get Started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="btn-ghost-pill inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-medium sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>

          <div
            className="rise relative mx-auto mt-20 max-w-[1080px] sm:mt-24"
            style={{ "--rise-delay": "260ms" } as React.CSSProperties}
          >
            <div className="fade-bottom">
              <HeroConsole />
            </div>
            <p className="mt-2 text-center text-xs text-muted-2">
              Energy console · modeled local grid
            </p>
          </div>
        </div>
      </section>

      {/* CATEGORY STRIP */}
      <section className="relative border-y border-border">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 px-5 py-8 sm:px-8">
          <p className="tracked-caps text-xs font-medium text-muted">
            Built for
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
            {["Utilities", "Microgrids", "Cities", "EV fleets", "Energy communities"].map(
              (item) => (
                <span
                  key={item}
                  className="rounded border border-border px-3 py-1.5 text-sm font-medium text-foreground/80"
                >
                  {item}
                </span>
              ),
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
                        Powered by Solana
          </p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
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
        className="mx-auto w-full max-w-[1240px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <FadeIn>
          <SectionHeader
            title="From prediction to settlement, five steps apart."
            subtitle="GridFlex turns a forecasted grid constraint into coordinated local action."
          />
        </FadeIn>

        <FadeIn delay={100} className="mt-14">
          <WorkflowRail steps={workflowSteps} />
        </FadeIn>
      </section>

      {/* WHAT COUNTS AS FLEXIBILITY */}
      <section
        id="flexibility"
        className="relative scroll-mt-20 overflow-hidden py-20 sm:py-28"
      >
        <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <FadeIn>
          <SectionHeader title="The grid doesn't only need more generation. It needs flexibility." />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <FlexInstrumentPanel
            items={[
              {
                icon: Sun,
                title: "Generate",
                examples: ["Solar", "Generators", "Microgrids"],
                description: "Export additional power during constrained periods.",
              },
              {
                icon: Battery,
                title: "Store",
                examples: ["Home batteries", "Commercial storage", "Vehicle-to-grid"],
                description: "Release stored energy when local demand is highest.",
              },
              {
                icon: Clock,
                title: "Shift",
                examples: ["EV charging", "HVAC", "Water heating", "Industrial demand"],
                description: "Move electricity use away from congested periods.",
              },
              {
                icon: TrendingDown,
                title: "Reduce",
                examples: ["Commercial loads", "Buildings", "Industrial equipment"],
                description: "Temporarily reduce consumption in exchange for compensation.",
              },
            ]}
          />
        </FadeIn>
        </div>
      </section>

      {/* GRID INTELLIGENCE */}
      <section
        id="technology"
        className="relative scroll-mt-20 overflow-hidden border-y border-border bg-background-raised py-20 sm:py-28"
      >
        <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8">
          <FadeIn>
            <SectionHeader
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
        className="mx-auto w-full max-w-[1240px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <FadeIn>
          <SectionHeader
            title="Grid constraints are local. Flexibility should be too."
            subtitle="A battery hundreds of miles away cannot relieve an overloaded neighborhood feeder. GridFlex matches flexibility to the specific zone where capacity is needed."
          />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <GridMapPreview />
        </FadeIn>
      </section>

      {/* WHY SOLANA */}
      <section id="settlement" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-28">
        <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <FadeIn>
          <SectionHeader
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
        </div>
      </section>

      {/* MICROGRID USE CASE */}
      <section
        id="about"
        className="mx-auto w-full max-w-[1240px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28"
      >
        <FadeIn>
          <SectionHeader
            title="Useful beyond the grid edge, wherever electricity is fragmented."
            subtitle="In regions with unreliable utility supply, electricity may come from a mixture of the grid, rooftop solar, batteries, diesel generators, and neighborhood microgrids. GridFlex can coordinate those resources instead of treating each one as an isolated backup system."
          />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <MicrogridFlow />
        </FadeIn>
      </section>

      {/* PARTICIPANT EXPERIENCE */}
      <section className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
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
      <section className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
        <FadeIn>
          <SectionHeader title="When the grid needs help, the market responds." />
        </FadeIn>
        <FadeIn delay={100} className="mt-10">
          <MarketTable />
        </FadeIn>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto w-full max-w-[1240px] px-5 pb-20 sm:px-8 sm:pb-28">
        <FadeIn>
          <CTASection />
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}
