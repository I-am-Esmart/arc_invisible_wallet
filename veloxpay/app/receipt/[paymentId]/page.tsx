import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PaymentTimeline } from "@/components/shared/payment-timeline";
import { ReceiptActions } from "@/components/payment/receipt-actions";
import { getPaymentReceipt, listPayments } from "@/lib/api/payments";
import { getSmartRequestByPaymentLinkId } from "@/lib/api/smart-requests";
import {
  buildSmartRequestReceiptVerification,
  formatAllocationBps,
} from "@/lib/smart-requests/receipt";
import type { SmartRequest } from "@/lib/types/smart-request";
import { formatDate, formatMoney } from "@/lib/utils/format";

type ReceiptPageProps = {
  params: Promise<{
    paymentId: string;
  }>;
  searchParams: Promise<{
    ownerEmail?: string;
  }>;
};

export default async function ReceiptPage({ params, searchParams }: ReceiptPageProps) {
  const { paymentId } = await params;
  const { ownerEmail = "" } = await searchParams;
  const payment = await getPaymentReceipt(paymentId).catch(async () => {
    if (!ownerEmail) {
      return null;
    }

    const ownerPayments = await listPayments(ownerEmail).catch(() => []);
    return ownerPayments.find((entry) => entry.id === paymentId) || null;
  });

  if (!payment) {
    notFound();
  }

  const smartRequest = payment.linkId
    ? await getSmartRequestByPaymentLinkId(payment.linkId)
        .then((response) => response.smartRequest)
        .catch(() => null)
    : null;
  const verification = buildSmartRequestReceiptVerification(payment, smartRequest);
  const receiptUrl = payment.receiptUrl || `/receipt/${payment.id}`;

  return (
    <main className="receipt-page mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Receipt</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Payment confirmation</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Share this page as proof that the payment request was completed.
        </p>
      </section>

      <Card className="print:rounded-none print:p-0 print:shadow-none print:ring-0">
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
              {smartRequest ? (
                <>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Payment mode</div>
                    <div className="mt-1 capitalize text-slate-900">{smartRequest.mode}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Contract status</div>
                    <div className="mt-1 text-slate-900">{smartRequest.onchainStatus}</div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <ReceiptActions receiptUrl={receiptUrl} />
        </div>

        {smartRequest && verification ? (
          <SmartRequestReceiptDetails
            smartRequest={smartRequest}
            paymentTransactionHash={payment.transactionHash || ""}
            paymentExplorerUrl={payment.explorerUrl || ""}
            verification={verification}
          />
        ) : null}

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
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          .receipt-page {
            color: #0f172a;
            font-size: 11px;
            line-height: 1.45;
          }

          .receipt-page a {
            color: #0f172a;
            text-decoration: none;
          }

          .receipt-page section,
          .receipt-page article,
          .receipt-page .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}

function SmartRequestReceiptDetails({
  smartRequest,
  paymentTransactionHash,
  paymentExplorerUrl,
  verification,
}: {
  smartRequest: SmartRequest;
  paymentTransactionHash: string;
  paymentExplorerUrl: string;
  verification: NonNullable<ReturnType<typeof buildSmartRequestReceiptVerification>>;
}) {
  const fundingExplorerUrl = paymentExplorerUrl || explorerUrl(smartRequest.fundingTransactionHash || paymentTransactionHash);
  const releaseOrRefundHash = smartRequest.releaseTransactionHash || smartRequest.refundTransactionHash || "";
  const releaseOrRefundExplorerUrl = explorerUrl(releaseOrRefundHash);

  return (
    <div className="mt-8 space-y-6">
      <section className={`avoid-break rounded-3xl border p-5 ${
        verification.status === "verified"
          ? "border-emerald-200 bg-emerald-50"
          : verification.status === "failed"
            ? "border-rose-200 bg-rose-50"
            : "border-amber-200 bg-amber-50"
      }`}>
        <div className="text-sm font-semibold text-slate-900">{verification.label}</div>
        <p className="mt-2 text-sm leading-6 text-slate-700">{verification.reason}</p>
        <div className="mt-4 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
          <HashLine label="Recalculated metadata hash" value={verification.recalculatedMetadataHash} />
          <HashLine label="Contract metadata hash" value={verification.contractMetadataHash || "-"} />
        </div>
      </section>

      <section className="avoid-break rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Smart Request details</h2>
        <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <Detail label="Payment mode" value={smartRequest.mode} />
          <Detail label="Onchain request ID" value={smartRequest.onchainRequestId || "-"} mono />
          <Detail label="Contract address" value={smartRequest.contractAddress || "-"} mono />
          <Detail label="Network" value={smartRequest.chain || "-"} />
          <Detail label="Token address" value={smartRequest.tokenAddress || "-"} mono />
          <Detail label="Current onchain status" value={smartRequest.onchainStatus || "-"} />
          <Detail label="Payer" value={smartRequest.actualPayerEmail || smartRequest.expectedPayerEmail || "-"} />
          <Detail label="Payer wallet" value={smartRequest.actualPayerWalletAddress || "-"} mono />
          <Detail label="Creator" value={smartRequest.creatorUserId || "-"} />
          <Detail label="Creator wallet" value={smartRequest.creatorWalletAddress || "-"} mono />
          <Detail label="Metadata hash" value={smartRequest.metadataHash || "-"} mono />
          <Detail label="Deliverable hash" value={smartRequest.deliverableHash || "-"} mono />
        </div>
      </section>

      <section className="avoid-break rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recipients and settlement</h2>
        <div className="mt-4 space-y-3">
          {smartRequest.recipients.map((recipient, index) => (
            <div key={`${recipient.walletAddress}-${index}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{recipient.name || recipient.email || `Recipient ${index + 1}`}</div>
                  {recipient.role ? <div className="mt-1 text-xs text-slate-500">{recipient.role}</div> : null}
                  {recipient.email ? <div className="mt-1 text-xs text-slate-500">{recipient.email}</div> : null}
                </div>
                <div className="text-left sm:text-right">
                  <div>{formatAllocationBps(recipient.allocationBps)}</div>
                  <div className="font-semibold text-slate-900">{recipient.amount} {smartRequest.currency}</div>
                </div>
              </div>
              <div className="mt-2 break-all font-mono text-xs text-slate-500">{recipient.walletAddress}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="avoid-break rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Transactions and timestamps</h2>
        <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <TransactionDetail label="Funding transaction" hash={smartRequest.fundingTransactionHash || paymentTransactionHash} href={fundingExplorerUrl} />
          <TransactionDetail label="Release or refund transaction" hash={releaseOrRefundHash || "-"} href={releaseOrRefundExplorerUrl} />
          <Detail label="Created" value={formatDate(verification.timestamps.created)} />
          <Detail label="Funded" value={formatDate(verification.timestamps.funded)} />
          <Detail label="Submitted" value={formatDate(verification.timestamps.submitted)} />
          <Detail label="Settled" value={formatDate(verification.timestamps.settled)} />
        </div>
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 break-all text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value || "-"}</div>
    </div>
  );
}

function HashLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-slate-900">{value}</div>
    </div>
  );
}

function TransactionDetail({
  label,
  hash,
  href,
}: {
  label: string;
  hash: string;
  href: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-slate-900">{hash || "-"}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-medium text-brand-600 hover:underline">
          View on Arc Explorer
        </a>
      ) : null}
    </div>
  );
}

function explorerUrl(hash: string) {
  return hash && hash !== "-" ? `https://testnet.arcscan.app/tx/${hash}` : "";
}
