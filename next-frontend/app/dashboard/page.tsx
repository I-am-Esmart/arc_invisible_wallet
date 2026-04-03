import Link from "next/link";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { PaymentLinksTable } from "@/components/dashboard/payment-links-table";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listPaymentLinks } from "@/lib/api/payment-links";
import { listPayments } from "@/lib/api/payments";

export default async function DashboardPage() {
  const [paymentLinks, payments] = await Promise.all([
    listPaymentLinks(),
    listPayments(),
  ]);

  return (
    <main className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Manage payment links and incoming payments
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Create public payment URLs, track who paid, and keep the flow friendly for
            non-crypto users.
          </p>
        </div>
        <Button asChild>
          <Link href="/create">Create new link</Link>
        </Button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <CreateLinkForm compact />
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Quick stats</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Links created</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">
                {paymentLinks.length}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Payments tracked</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">
                {payments.length}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6">
        <PaymentLinksTable paymentLinks={paymentLinks} />
        <PaymentsTable payments={payments} />
      </section>
    </main>
  );
}
