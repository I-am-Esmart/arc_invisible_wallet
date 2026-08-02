import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import { VeloxPayLogo } from "@/components/brand/veloxpay-logo";
import { Button } from "@/components/ui/button";
import { ProductMockup } from "@/components/marketing/product-mockup";
import { SplitFlowDiagram } from "@/components/marketing/split-flow-diagram";
import { HowItWorksSteps } from "@/components/marketing/how-it-works";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { CtaButton } from "@/components/marketing/cta-button";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const outcomes = [
  ["Standard payments", "Simple checkout for direct stablecoin requests."],
  ["Split payments", "Automatic recipient allocation from a single payer action."],
  ["Protected payments", "Contract-held funds released after delivery approval."],
];

export default function HomePage() {
  return (
    <main className="pb-14">
      <section className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.14),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(96,165,250,0.18),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
        <div className="relative grid gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 lg:py-16">
          <div>
            <div className="flex items-center gap-4">
              <VeloxPayLogo className="h-14 w-14" />
              <p className="vp-eyebrow">Programmable money on Arc</p>
            </div>
            <RevealGroup stagger={0.1}>
              <RevealItem y={20} duration={0.4}>
                <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink-heading sm:text-6xl">
                  Programmable stablecoin payments for global teams.
                </h1>
              </RevealItem>
              <RevealItem y={20} duration={0.4}>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-body">
                  Create payment requests. Split payments automatically. Protect funds until work is approved.
                </p>
              </RevealItem>
              <RevealItem y={20} duration={0.4}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <CtaButton>
                    <Button asChild className="gap-2">
                      <Link href="/dashboard">
                        Launch App
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CtaButton>
                  <Button asChild variant="secondary">
                    <Link href="#smart-requests">Explore Smart Requests</Link>
                  </Button>
                </div>
              </RevealItem>
            </RevealGroup>
          </div>

          <ProductMockup />
        </div>
      </section>

      <section className="py-16">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="vp-eyebrow mx-auto">Built for programmable stablecoin payments</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">
            From a simple link to contract-aware settlement.
          </h2>
        </Reveal>
        <FeatureCards />
      </section>

      <section className="rounded-2xl border border-line bg-slate-50 p-6 sm:p-8">
        <Reveal className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="vp-eyebrow">How it works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading">
              A checkout flow your customer can finish.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-ink-body">
            VeloxPay keeps the request, wallet action, settlement status, and receipt trail connected from start to finish.
          </p>
        </Reveal>

        <HowItWorksSteps />
      </section>

      <section id="smart-requests" className="grid gap-8 py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <SplitFlowDiagram />
        <div>
          <Reveal>
            <p className="vp-eyebrow">Smart Requests</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink-heading">
              One payment. Multiple outcomes.
            </h2>
            <p className="mt-4 text-base leading-7 text-ink-body">
              VeloxPay turns a payment link into a programmable workflow: settle directly, split funds, or hold payment until delivery is approved.
            </p>
          </Reveal>
          <RevealGroup stagger={0.1} className="mt-7 space-y-4">
            {outcomes.map(([title, description]) => (
              <RevealItem key={title}>
                <div className="rounded-2xl border border-line bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 text-brand-700" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-ink-heading">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-ink-body">{description}</p>
                    </div>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <p className="vp-eyebrow">Arc infrastructure</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading">
              Built on Arc infrastructure.
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-body">
              VeloxPay uses Arc and Circle infrastructure to make stablecoin requests easier to create, fund, settle, and verify.
            </p>
          </Reveal>
          <RevealGroup stagger={0.1} className="grid gap-4 md:grid-cols-3">
            {[
              ["Arc settlement", "Fast stablecoin settlement for USDC and EURC workflows."],
              ["Circle infrastructure", "Wallet and transaction rails for the app experience."],
              ["Programmable settlement", "Smart Request rules for splits, protection, and receipts."],
            ].map(([title, description]) => (
              <RevealItem key={title}>
                <div className="rounded-2xl border border-line bg-slate-50 p-5">
                  <h3 className="text-sm font-semibold text-ink-heading">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-body">{description}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <Reveal className="mt-8 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 p-8 text-center shadow-card sm:p-12">
        <h2 className="text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">
          Ready to simplify stablecoin payments?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-body">
          Launch VeloxPay to create a wallet, send a request, or manage Smart Request settlement on Arc.
        </p>
        <div className="mt-8">
          <CtaButton>
            <Button asChild className="gap-2">
              <Link href="/dashboard">
                Launch VeloxPay
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CtaButton>
        </div>
      </Reveal>
    </main>
  );
}
