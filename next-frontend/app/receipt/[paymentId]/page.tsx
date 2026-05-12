import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PaymentTimeline } from "@/components/shared/payment-timeline";
import { ReceiptActions } from "@/components/payment/receipt-actions";
import { getPaymentReceipt } from "@/lib/api/payments";
import { formatDate, formatMoney } from "@/lib/utils/format";

type ReceiptPageProps = {
  params: Promise<{
    paymentId: string;
  }>;
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { paymentId } = await params;
  const payment = await getPaymentReceipt(paymentId).catch(() => null);

  if (!payment) {
    notFound();
  }

  const receiptUrl = payment.receiptUrl || `/receipt/${payment.id}`;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Receipt</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Payment confirmation</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Share this page as proof that the payment request was completed.
        </p>
      </section>

      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-slate-500">Amount paid</div>
              <div className="mt-1 text-4xl font-semibold text-slate-900">
                {formatMoney(payment.amount, payment.currency)}
              </div>
            </div>
            <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment request</div>
                <div className="mt-1 text-slate-900">{payment.linkLabel || payment.linkId}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Paid at</div>
                <div className="mt-1 text-slate-900">{formatDate(payment.paidAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Payer</div>
                <div className="mt-1 text-slate-900">{payment.payerEmail || "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</div>
                <div className="mt-1 text-slate-900">{payment.status}</div>
              </div>
            </div>
          </div>

          <ReceiptActions receiptUrl={receiptUrl} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Receipt timeline</h2>
            <div className="mt-4">
              <PaymentTimeline timeline={payment.timeline} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Transaction details</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Transaction hash</div>
                <div className="mt-1 break-all font-mono text-slate-900">{payment.transactionHash || "-"}</div>
              </div>
              {payment.explorerUrl ? (
                <a
                  href={payment.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center font-medium text-brand-600 hover:underline"
                >
                  View on Arc Explorer
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
