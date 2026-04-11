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
          Your wallet and payment tools now live in one place. Use the pages below to move money, collect by link, and track what&apos;s happening.
        </p>
      </section>

      {(errors.balances || errors.links || errors.payments) ? (
        <Card className="border border-amber-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-amber-900">Some data is still loading</h2>
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

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Wallet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Check balances, copy your address, fund with the faucet, and review wallet activity.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/wallet">Open wallet</Link>
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Send funds</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Send USDC or EURC directly from the wallet that powers your payment links.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/wallet/send">Go to send</Link>
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Payment links</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create shareable links, copy them fast, and keep all your link records together.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/links">Manage links</Link>
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
