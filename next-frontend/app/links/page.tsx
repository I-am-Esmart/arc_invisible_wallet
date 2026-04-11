"use client";

import { useMemo } from "react";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { PaymentLinksTable } from "@/components/dashboard/payment-links-table";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";

export default function LinksPage() {
  const { walletUser, paymentLinks, errors, refreshLinks, refreshPayments } = useVeloxPayData({
    includeLinks: true,
    includePayments: true,
  });

  const activeLinks = useMemo(
    () => paymentLinks.filter((link) => link.status === "active").length,
    [paymentLinks],
  );

  if (!walletUser) {
    return <WalletRequiredState title="Create your wallet before making payment links" />;
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Payment links</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create and manage your links</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Build shareable payment links from your connected wallet and keep the records organized in one place.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {activeLinks} active link{activeLinks === 1 ? "" : "s"}
        </div>
      </section>

      {errors.links ? (
        <Card className="border border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{errors.links}</p>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <CreateLinkForm
          walletUser={walletUser}
          onCreated={async () => {
            await refreshLinks();
            await refreshPayments();
          }}
        />
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Link tips</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>Use short, clear descriptions so people know exactly what they are paying for.</p>
            <p>Every new link is unique, even if the amount is the same.</p>
            <p>After a payment lands, it will also show up in your incoming payments view.</p>
          </div>
        </Card>
      </section>

      <PaymentLinksTable paymentLinks={paymentLinks} />
    </main>
  );
}
