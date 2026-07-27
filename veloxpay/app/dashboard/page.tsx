"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";

function formatBalance(balance: string) {
  const value = Number(balance);
  return Number.isFinite(value) ? value.toFixed(2) : balance;
}

export default function DashboardPage() {
  const { walletUser, balances, totals, errors, loading } = useVeloxPayData({
    includeBalances: true,
    includeLinks: true,
    includePayments: true,
  });

  if (!walletUser) {
    return <WalletRequiredState />;
  }

  return (
    <main className="space-y-8">
      <section className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_45%,_#eef5ff)] p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
        <p className="inline-flex rounded-full bg-brand-50 px-4 py-1 text-sm font-medium uppercase tracking-[0.18em] text-brand-700">
          VeloxPay overview
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Welcome back, {walletUser.displayName || walletUser.username || "there"}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          Create Smart Requests that get paid normally, split funds across a team, or hold payment in the Arc contract until delivery is approved.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/links">Create Smart Request</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/payments">Manage protected payments</Link>
          </Button>
        </div>
      </section>

      {(errors.balances || errors.links || errors.payments) ? (
        <Card className="border border-amber-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-amber-900">Some data could not be loaded</h2>
          <div className="mt-2 space-y-1 text-sm text-amber-800">
            {errors.balances ? <p>{errors.balances}</p> : null}
            {errors.links ? <p>{errors.links}</p> : null}
            {errors.payments ? <p>{errors.payments}</p> : null}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-slate-500">USDC balance</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">
            {loading ? "..." : formatBalance(balances.USDC?.balance || "0")}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">EURC balance</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">
            {loading ? "..." : formatBalance(balances.EURC?.balance || "0")}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Links created</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">{totals.links}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Payments tracked</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">{totals.completedPayments}</div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Smart Request modes</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Standard</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                One payer, one recipient, one clean link for simple USDC or EURC checkout.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Split</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add up to 10 recipients and let the contract distribute exact percentages.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Protected</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Funds stay in escrow until the deliverable is submitted and the payer releases payment.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Protected workflow</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>1. Payer funds the request into the Arc smart contract.</p>
            <p>2. Payee submits a deliverable URL and hash.</p>
            <p>3. Payer approves release, or eligible refunds follow contract rules.</p>
          </div>
          <div className="mt-5">
            <Button asChild>
              <Link href="/links">Create protected request</Link>
            </Button>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Create requests</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Choose standard, split, or protected mode, then review recipients, percentages, and contract behavior.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/links">Open request builder</Link>
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Protected payments</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Submit deliverables as a payee, approve releases as a payer, and follow the contract timeline.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/payments">Review protected payments</Link>
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Wallet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Check USDC and EURC balances, copy your address, fund testnet wallets, and send funds directly.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/wallet">Open wallet</Link>
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Incoming payments</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            See completed payments, explorer links, and incoming transfer records in one place.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/payments">View payments</Link>
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}
