"use client";

import { Card } from "@/components/ui/card";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";

export default function PaymentsPage() {
  const { walletUser, payments, errors, refreshPayments, totals } = useVeloxPayData({
    includePayments: true,
  });

  if (!walletUser) {
    return <WalletRequiredState title="Create your wallet before tracking payments" />;
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Incoming payments</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Track what lands in your wallet</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Review completed payment-link checkouts and incoming wallet transfers from one screen.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {totals.completedPayments} payment{totals.completedPayments === 1 ? "" : "s"} tracked
        </div>
      </section>

      {errors.payments ? (
        <Card className="border border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{errors.payments}</p>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <button
          onClick={refreshPayments}
          className="inline-flex items-center rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
        >
          Refresh payments
        </button>
      </div>

      <PaymentsTable payments={payments} />
    </main>
  );
}
