import Link from "next/link";
import { VeloxPayLogo } from "@/components/brand/veloxpay-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BUILDER_X_URL = process.env.NEXT_PUBLIC_BUILDER_X_URL || "https://x.com/cryptosmart121";

function XLogo() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18.901 1.154H22.58l-8.04 9.188L24 22.846h-7.406l-5.8-7.584-6.637 7.584H.476l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932Zm-1.291 19.49h2.039L6.486 3.248H4.298L17.61 20.644Z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="space-y-8 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="flex items-center gap-4">
              <VeloxPayLogo className="h-16 w-16" />
              <p className="inline-flex rounded-full bg-brand-50 px-4 py-1 text-sm font-semibold uppercase text-brand-700">
                Arc programmable payments
              </p>
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              VeloxPay Smart Requests
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Payment links that can settle normally, split USDC or EURC across a team,
              or hold funds in an Arc smart contract until delivery is approved.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard">Create Smart Request</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/login">Create or restore wallet</Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <div className="font-semibold text-slate-900">Split payments</div>
                <div>Allocate up to 10 recipients with exact basis points.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Protected delivery</div>
                <div>Hold funds until the payer approves the submitted work.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Circle + Arc</div>
                <div>Developer wallets, contract calls, and receipt verification.</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <VeloxPayLogo className="h-12 w-12" showWordmark textClassName="text-xl font-semibold tracking-tight text-white" />
              <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase text-emerald-200">
                protected
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 text-slate-950">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Agency website build</div>
                  <div className="mt-2 text-3xl font-semibold">1,000 USDC</div>
                </div>
                <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Arc Testnet</div>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  ["Developer", "60%", "600 USDC"],
                  ["Designer", "20%", "200 USDC"],
                  ["Project manager", "10%", "100 USDC"],
                  ["Agency treasury", "10%", "100 USDC"],
                ].map(([label, percent, amount]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-medium">{label}</span>
                    <span className="text-slate-500">{percent}</span>
                    <span className="font-semibold">{amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-white/55">Step 1</div>
                <div className="mt-1 font-semibold">Fund request</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-white/55">Step 2</div>
                <div className="mt-1 font-semibold">Submit delivery</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-white/55">Step 3</div>
                <div className="mt-1 font-semibold">Release split</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/90">
          <h2 className="text-lg font-semibold text-slate-900">1. Create a request</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Choose standard, split, or protected mode, then add recipients and percentages.
          </p>
        </Card>
        <Card className="bg-white/90">
          <h2 className="text-lg font-semibold text-slate-900">2. Payer funds on Arc</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            VeloxPay checks balance, allowance, Circle transactions, and contract state.
          </p>
        </Card>
        <Card className="bg-white/90">
          <h2 className="text-lg font-semibold text-slate-900">3. Verify the receipt</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Receipts compare canonical metadata with the onchain Smart Request record.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Built for programmable stablecoin work</h2>
          <p className="mt-2 text-sm text-slate-600">
            Circle Wallets handle user custody, Circle Contracts routes contract execution, and Arc settles the request.
          </p>
        </div>
        <a
          href={BUILDER_X_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <XLogo />
          built by smart
        </a>
      </section>
    </main>
  );
}
