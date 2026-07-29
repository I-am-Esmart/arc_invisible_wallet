"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { ProtectedRequestsPanel } from "@/components/payment/protected-requests-panel";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { listPayments } from "@/lib/api/payments";
import type { Payment } from "@/lib/types/payment";

export default function PaymentsPage() {
  const { walletUser, payments, errors, refreshPayments, totals } = useVeloxPayData({
    includePayments: true,
  });
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
  const [outgoingPayments, setOutgoingPayments] = useState<Payment[]>([]);
  const [outgoingError, setOutgoingError] = useState("");
  const [loadingOutgoing, setLoadingOutgoing] = useState(false);

  useEffect(() => {
    if (!walletUser?.email) {
      return;
    }

    setLoadingOutgoing(true);
    listPayments({ payerEmail: walletUser.email })
      .then(setOutgoingPayments)
      .catch((error) => {
        setOutgoingError(error instanceof Error ? error.message : "Unable to load outgoing payments.");
      })
      .finally(() => setLoadingOutgoing(false));
  }, [walletUser?.email]);

  const activePayments = activeTab === "incoming" ? payments : outgoingPayments;
  const activeCopy = useMemo(() => (
    activeTab === "incoming"
      ? {
          title: "Incoming payments",
          description: "Payments received from customers and payment requests.",
          emptyMessage: "No incoming payments yet.",
        }
      : {
          title: "Outgoing payments",
          description: "Payments you made from this VeloxPay wallet, including receipt links where available.",
          emptyMessage: "No outgoing payments yet.",
        }
  ), [activeTab]);

  async function refreshAllPayments() {
    await refreshPayments();

    if (!walletUser?.email) {
      return;
    }

    setLoadingOutgoing(true);
    setOutgoingError("");
    try {
      setOutgoingPayments(await listPayments({ payerEmail: walletUser.email }));
    } catch (error) {
      setOutgoingError(error instanceof Error ? error.message : "Unable to load outgoing payments.");
    } finally {
      setLoadingOutgoing(false);
    }
  }

  if (!walletUser) {
    return <WalletRequiredState title="Create your wallet before tracking payments" />;
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-8 shadow-card lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="vp-eyebrow">Payments</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink-heading">Track money movement and receipts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-body">
            Review money received and payments you made, including receipt links for completed payment requests.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-ink-body">
          {totals.completedPayments + outgoingPayments.length} payment{totals.completedPayments + outgoingPayments.length === 1 ? "" : "s"} tracked
        </div>
      </section>

      {(errors.payments || outgoingError) ? (
        <Card className="border border-amber-200 bg-amber-50">
          {errors.payments ? <p className="text-sm text-amber-800">{errors.payments}</p> : null}
          {outgoingError ? <p className="text-sm text-amber-800">{outgoingError}</p> : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("incoming")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "incoming" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Incoming
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("outgoing")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "outgoing" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Outgoing
          </button>
        </div>
        <button
          onClick={refreshAllPayments}
          className="inline-flex items-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-body shadow-sm transition hover:bg-slate-50"
        >
          {loadingOutgoing ? "Refreshing..." : "Refresh payments"}
        </button>
      </div>

      <PaymentsTable
        payments={activePayments}
        title={activeCopy.title}
        description={activeCopy.description}
        emptyMessage={activeCopy.emptyMessage}
      />

      <ProtectedRequestsPanel walletUser={walletUser} />
    </main>
  );
}
