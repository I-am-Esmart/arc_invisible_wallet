import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Link2,
  Lock,
  ReceiptText,
  Send,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { VeloxPayLogo } from "@/components/brand/veloxpay-logo";
import { Button } from "@/components/ui/button";

const trustCards = [
  {
    icon: Link2,
    title: "Payment Links",
    description: "Create clean checkout links for USDC and EURC requests in seconds.",
  },
  {
    icon: Users,
    title: "Smart Splits",
    description: "Route one payment across collaborators, vendors, and treasury wallets.",
  },
  {
    icon: Shield,
    title: "Protected Payments",
    description: "Hold funds until work is submitted, verified, and approved.",
  },
  {
    icon: ReceiptText,
    title: "Verified Receipts",
    description: "Track settlement, metadata, recipients, and explorer links after payment.",
  },
];

const steps = [
  { icon: Wallet, title: "Create payment request" },
  { icon: Link2, title: "Share payment link" },
  { icon: Send, title: "Receive USDC/EURC" },
  { icon: CheckCircle, title: "Track settlement" },
];

const outcomes = [
  ["Standard payments", "Simple checkout for direct stablecoin requests."],
  ["Split payments", "Automatic recipient allocation from a single payer action."],
  ["Protected payments", "Contract-held funds released after delivery approval."],
];

function ProductMockup() {
  return (
    <div className="relative animate-[fadeIn_500ms_ease-out]">
      <div className="absolute -left-8 top-12 hidden rounded-2xl border border-brand-100 bg-white p-4 shadow-card lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Protected</div>
            <div className="text-sm font-semibold text-ink-heading">Funds held on Arc</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-5 bottom-10 hidden rounded-2xl border border-line bg-white p-4 shadow-card sm:block">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Settlement</div>
        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          Verified receipt ready
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_rgba(37,99,235,0.18)]">
        <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="h-3 w-3 rounded-full bg-slate-300" />
          <span className="ml-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-muted ring-1 ring-line">
            useveloxpay.xyz/dashboard
          </span>
        </div>

        <div className="grid gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="vp-eyebrow">Smart Request</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-ink-heading">1,000 USDC</div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-ink-body">
                Website development milestone with protected release.
              </p>
            </div>
            <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Arc Network
            </div>
          </div>

          <div className="grid gap-3">
            {[
              ["Developer", "60%", "600 USDC"],
              ["Designer", "20%", "200 USDC"],
              ["Project manager", "10%", "100 USDC"],
              ["Agency treasury", "10%", "100 USDC"],
            ].map(([name, percent, amount]) => (
              <div key={name} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold text-ink-heading">{name}</span>
                <span className="text-ink-muted">{percent}</span>
                <span className="font-semibold text-ink-heading">{amount}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["Funded", "Submitted", "Ready to release"].map((label) => (
              <div key={label} className="rounded-xl border border-brand-100 bg-brand-50 p-3">
                <div className="h-2 w-2 rounded-full bg-brand" />
                <div className="mt-3 text-sm font-semibold text-brand-700">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
            <h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink-heading sm:text-6xl [animation:fadeIn_700ms_ease-out]">
              Programmable stablecoin payments for global teams.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-body [animation:fadeIn_850ms_ease-out]">
              Create payment requests. Split payments automatically. Protect funds until work is approved.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 [animation:fadeIn_1000ms_ease-out]">
              <Button asChild className="gap-2">
                <Link href="/dashboard">
                  Launch App
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="#smart-requests">Explore Smart Requests</Link>
              </Button>
            </div>
          </div>

          <ProductMockup />
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="vp-eyebrow mx-auto">Built for programmable stablecoin payments</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">
            From a simple link to contract-aware settlement.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {trustCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-2xl border border-line bg-white p-6 shadow-card transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink-heading">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-body">{card.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-slate-50 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="vp-eyebrow">How it works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading">
              A checkout flow your customer can finish.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-ink-body">
            VeloxPay keeps the request, wallet action, settlement status, and receipt trail connected from start to finish.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative rounded-2xl border border-line bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-ink-muted">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-ink-heading">{step.title}</h3>
              </div>
            );
          })}
        </div>
      </section>

      <section id="smart-requests" className="grid gap-8 py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <ProductMockup />
        <div>
          <p className="vp-eyebrow">Smart Requests</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink-heading">
            One payment. Multiple outcomes.
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-body">
            VeloxPay turns a payment link into a programmable workflow: settle directly, split funds, or hold payment until delivery is approved.
          </p>
          <div className="mt-7 space-y-4">
            {outcomes.map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-line bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-brand-700" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-ink-heading">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-body">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="vp-eyebrow">Arc infrastructure</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading">
              Built on Arc infrastructure.
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-body">
              VeloxPay uses Arc and Circle infrastructure to make stablecoin requests easier to create, fund, settle, and verify.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Arc settlement", "Fast stablecoin settlement for USDC and EURC workflows."],
              ["Circle infrastructure", "Wallet and transaction rails for the app experience."],
              ["Programmable settlement", "Smart Request rules for splits, protection, and receipts."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-line bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-ink-heading">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-body">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 p-8 text-center shadow-card sm:p-12">
        <h2 className="text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">
          Ready to simplify stablecoin payments?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-body">
          Launch VeloxPay to create a wallet, send a request, or manage Smart Request settlement on Arc.
        </p>
        <div className="mt-8">
          <Button asChild className="gap-2">
            <Link href="/dashboard">
              Launch VeloxPay
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
