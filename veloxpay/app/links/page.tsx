"use client";

import { useMemo } from "react";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { PaymentLinksTable } from "@/components/dashboard/payment-links-table";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";

export default function LinksPage() {
  const { walletUser, paymentLinks, customers, errors, refreshLinks, refreshPayments, refreshCustomers } = useVeloxPayData({
    includeLinks: true,
    includePayments: true,
    includeCustomers: true,
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
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-8 shadow-card lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="vp-eyebrow">Get paid</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink-heading">Create a payment request people instantly understand</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-body">
            Send a standard checkout, split a payment across collaborators, or protect delivery work in the Arc contract.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-ink-body">
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
          customers={customers}
          onCreated={async () => {
            await refreshLinks();
            await refreshPayments();
            await refreshCustomers();
          }}
        />
        <Card>
          <h2 className="text-lg font-semibold">Request types</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Standard", "One payer, one recipient, familiar checkout."],
              ["Split", "Multiple recipients, exact allocation percentages."],
              ["Protected", "Funds held until delivery is approved."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-xl border border-line bg-slate-50 p-4">
                <div className="text-sm font-semibold text-ink-heading">{title}</div>
                <p className="mt-1 text-sm leading-6 text-ink-body">{copy}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-700">
            Payment status, receipts, QR codes, and explorer links stay attached to the request after it is created.
          </div>
        </Card>
      </section>

      <PaymentLinksTable paymentLinks={paymentLinks} />
    </main>
  );
}
