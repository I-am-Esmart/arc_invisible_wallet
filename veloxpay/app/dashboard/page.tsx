"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle,
  Clock3,
  CreditCard,
  Link2,
  Plus,
  ReceiptText,
  Send,
  Shield,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { formatDate, formatMoney } from "@/lib/utils/format";
import type { Payment } from "@/lib/types/payment";
import type { PaymentCurrency, PaymentLink } from "@/lib/types/payment-link";

function formatBalance(balance: string) {
  const value = Number(balance);
  return Number.isFinite(value) ? value.toFixed(2) : balance;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function sumByCurrency<T extends { amount: string; currency: PaymentCurrency }>(items: T[]) {
  return items.reduce<Record<PaymentCurrency, number>>(
    (totals, item) => {
      const value = Number(item.amount);
      if (Number.isFinite(value)) {
        totals[item.currency] += value;
      }
      return totals;
    },
    { USDC: 0, EURC: 0 },
  );
}

function formatCurrencyTotals(totals: Record<PaymentCurrency, number>) {
  const values = (["USDC", "EURC"] as const)
    .filter((currency) => totals[currency] > 0)
    .map((currency) => `${totals[currency].toFixed(2)} ${currency}`);

  return values.length ? values.join(" + ") : "0.00";
}

function getRecentWindowStatus(current: number, previous: number, unit: string) {
  if (current === 0 && previous === 0) {
    return `No ${unit} yet`;
  }

  if (previous === 0) {
    return `${current} this week`;
  }

  const change = current - previous;
  if (change === 0) {
    return `Flat vs last week`;
  }

  return `${change > 0 ? "+" : ""}${change} vs last week`;
}

function isWithinDays(value: string | undefined, minDaysAgo: number, maxDaysAgo: number) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const now = Date.now();
  const age = now - timestamp;
  const day = 24 * 60 * 60 * 1000;
  return age >= minDaysAgo * day && age < maxDaysAgo * day;
}

function getModeLabel(link?: PaymentLink) {
  if (link?.paymentMode === "protected") {
    return "Protected payment";
  }

  if (link?.paymentMode === "split") {
    return "Split payment";
  }

  return "Payment";
}

function getPaymentStatus(payment: Payment, link?: PaymentLink) {
  if (link?.paymentMode === "protected") {
    return {
      label: "Protected",
      className: "bg-brand-50 text-brand-700 ring-brand-100",
      icon: Shield,
    };
  }

  if (payment.status === "completed") {
    return {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      icon: CheckCircle,
    };
  }

  if (payment.status === "pending") {
    return {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
      icon: Clock3,
    };
  }

  return {
    label: "Pending",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Clock3,
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  status: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-line">
          {status}
        </span>
      </div>
      <div className="mt-5 text-2xl font-semibold tracking-tight text-ink-heading">{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </Card>
  );
}

function EmptyActivity() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line bg-slate-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-line">
        <ReceiptText className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-heading">No payment activity yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-body">
        Create a request and completed payments will appear here with status, date, receipt, and explorer links.
      </p>
      <div className="mt-5">
        <Button asChild>
          <Link href="/links">Create Payment Request</Link>
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { walletUser, balances, totals, errors, loading, payments, paymentLinks } = useVeloxPayData({
    includeBalances: true,
    includeLinks: true,
    includePayments: true,
  });

  const linkById = useMemo(
    () => new Map(paymentLinks.map((link) => [link.id, link])),
    [paymentLinks],
  );

  const completedPayments = useMemo(
    () => payments.filter((payment) => payment.status === "completed"),
    [payments],
  );

  const receivedTotals = useMemo(() => sumByCurrency(completedPayments), [completedPayments]);
  const activeRequests = useMemo(
    () => paymentLinks.filter((link) => link.status === "active").length,
    [paymentLinks],
  );
  const currentWeekPayments = useMemo(
    () => completedPayments.filter((payment) => isWithinDays(payment.paidAt, 0, 7)).length,
    [completedPayments],
  );
  const previousWeekPayments = useMemo(
    () => completedPayments.filter((payment) => isWithinDays(payment.paidAt, 7, 14)).length,
    [completedPayments],
  );
  const currentWeekRequests = useMemo(
    () => paymentLinks.filter((link) => isWithinDays(link.createdAt, 0, 7)).length,
    [paymentLinks],
  );
  const previousWeekRequests = useMemo(
    () => paymentLinks.filter((link) => isWithinDays(link.createdAt, 7, 14)).length,
    [paymentLinks],
  );

  const recentPayments = useMemo(
    () =>
      [...payments]
        .sort((a, b) => {
          const left = a.paidAt ? new Date(a.paidAt).getTime() : 0;
          const right = b.paidAt ? new Date(b.paidAt).getTime() : 0;
          return right - left;
        })
        .slice(0, 6),
    [payments],
  );

  if (!walletUser) {
    return <WalletRequiredState />;
  }

  const displayName = walletUser.displayName || walletUser.username || "Smart";
  const usdcBalance = formatBalance(balances.USDC?.balance || "0");
  const eurcBalance = formatBalance(balances.EURC?.balance || "0");
  const totalBalanceValue = `${usdcBalance} USDC + ${eurcBalance} EURC`;

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="vp-eyebrow">VeloxPay dashboard</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">
              {getGreeting()}, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-body">
              Manage your stablecoin payments from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/links">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Payment Request
              </Link>
            </Button>
            <Button asChild variant="secondary" className="gap-2">
              <Link href="/wallet/send">
                <Send className="h-4 w-4" aria-hidden="true" />
                Send Payment
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {(errors.balances || errors.links || errors.payments) ? (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-amber-900">Some data could not be loaded</h2>
          <div className="mt-2 space-y-1 text-sm text-amber-800">
            {errors.balances ? <p>{errors.balances}</p> : null}
            {errors.links ? <p>{errors.links}</p> : null}
            {errors.payments ? <p>{errors.payments}</p> : null}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Total Balance"
          value={loading ? "Loading..." : totalBalanceValue}
          status="Live wallet"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Total Received"
          value={formatCurrencyTotals(receivedTotals)}
          status={getRecentWindowStatus(currentWeekPayments, previousWeekPayments, "payments")}
        />
        <StatCard
          icon={CheckCircle}
          label="Completed Payments"
          value={String(totals.completedPayments)}
          status={getRecentWindowStatus(currentWeekPayments, previousWeekPayments, "payments")}
        />
        <StatCard
          icon={Link2}
          label="Active Requests"
          value={String(activeRequests)}
          status={getRecentWindowStatus(currentWeekRequests, previousWeekRequests, "requests")}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-2xl border border-brand-100 bg-[linear-gradient(135deg,#2563EB,#1D4ED8)] p-6 text-white shadow-[0_24px_70px_rgba(37,99,235,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/70">VeloxPay Wallet</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Stablecoin account</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
              <div className="text-sm text-white/65">USDC balance</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{loading ? "..." : usdcBalance}</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
              <div className="text-sm text-white/65">EURC balance</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{loading ? "..." : eurcBalance}</div>
            </div>
          </div>

          <div className="mt-6 break-all rounded-xl bg-white/10 p-4 font-mono text-xs text-white/75 ring-1 ring-white/15">
            {walletUser.address}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/wallet/receive"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              Receive
            </Link>
            <Link
              href="/wallet/send"
              className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            >
              Send
            </Link>
          </div>
        </div>

        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink-heading">Payment Activity</h2>
              <p className="mt-1 text-sm text-ink-body">
                Recent payments with settlement status and explorer links.
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link href="/payments">View all</Link>
            </Button>
          </div>

          {recentPayments.length === 0 ? (
            <EmptyActivity />
          ) : (
            <div className="mt-6 divide-y divide-slate-100">
              {recentPayments.map((payment) => {
                const link = linkById.get(payment.linkId);
                const status = getPaymentStatus(payment, link);
                const StatusIcon = status.icon;

                return (
                  <div key={payment.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Activity className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-heading">{getModeLabel(link)}</div>
                        <div className="mt-1 truncate text-sm text-ink-muted">
                          {payment.customerName || payment.payerEmail || payment.linkLabel || payment.linkId}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-center">
                      <div className="text-left sm:text-right">
                        <div className="font-semibold text-ink-heading">
                          {formatMoney(payment.amount, payment.currency)}
                        </div>
                        <div className="mt-1 text-xs text-ink-muted">{formatDate(payment.paidAt)}</div>
                      </div>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {status.label}
                      </span>
                      {payment.explorerUrl ? (
                        <a
                          href={payment.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-hover"
                        >
                          Explorer
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-sm text-ink-muted">No explorer link</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Link2,
            title: "Create requests",
            copy: "Build standard, split, or protected payment links.",
            href: "/links",
            cta: "Open request builder",
          },
          {
            icon: Shield,
            title: "Protected payments",
            copy: "Submit deliverables, approve releases, and review contract state.",
            href: "/payments",
            cta: "Review protected payments",
          },
          {
            icon: ReceiptText,
            title: "Receipts",
            copy: "Keep receipt trails connected to payments and explorer links.",
            href: "/payments",
            cta: "View receipts",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink-heading">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-body">{item.copy}</p>
              <div className="mt-5">
                <Button asChild variant="secondary">
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
