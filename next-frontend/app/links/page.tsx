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
    return <WalletRequiredState title="Create your wallet before sending payment requests" />;
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Get paid</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create a payment request people instantly understand</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Turn any amount into a shareable invoice-style payment request. Send it to a client, customer, donor, or friend and let them pay from one clean page.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {activeLinks} active request{activeLinks === 1 ? "" : "s"}
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
          <h2 className="text-lg font-semibold text-slate-900">How to use this well</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>Use a clear description like “Logo design deposit”, “Consulting session”, or “Community support”.</p>
            <p>After you create the request, copy the link and send it anywhere you normally ask to be paid.</p>
            <p>Once the money lands, it will also appear in your incoming payments view and wallet records.</p>
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Simple examples</div>
            <div className="mt-2 space-y-2">
              <p>Client invoice</p>
              <p>Donation request</p>
              <p>Event access or digital download</p>
            </div>
          </div>
        </Card>
      </section>

      <PaymentLinksTable paymentLinks={paymentLinks} />
    </main>
  );
}
