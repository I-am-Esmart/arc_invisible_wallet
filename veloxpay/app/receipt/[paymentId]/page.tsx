import { notFound } from "next/navigation";
import { CheckCircle, Circle, ExternalLink, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReceiptActions } from "@/components/payment/receipt-actions";
import { getPaymentReceipt, listPayments } from "@/lib/api/payments";
import { getSmartRequestByPaymentLinkId } from "@/lib/api/smart-requests";
import {
  buildSmartRequestReceiptVerification,
  formatAllocationBps,
} from "@/lib/smart-requests/receipt";
import type { SmartRequest } from "@/lib/types/smart-request";
import type { PaymentTimelineEvent } from "@/lib/types/payment-link";
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
  const network = smartRequest?.chain || "Arc";
  const toLabel = smartRequest?.creatorUserId || payment.ownerEmail || payment.linkLabel || payment.linkId || "-";
  const fromLabel = payment.payerEmail || smartRequest?.actualPayerEmail || smartRequest?.expectedPayerEmail || "-";

  return (
    <main className="receipt-page mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_24px_80px_rgba(15,23,42,0.07)] print:rounded-none print:border-0 print:shadow-none">
        <div className="border-b border-line bg-gradient-to-br from-white via-white to-brand-50/50 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">Receipt</p>
                <h1 className="mt-1 text-2xl font-semibold text-ink-heading">Payment completed</h1>
              </div>
            </div>
            <div className="mt-8 text-5xl font-semibold tracking-tight text-ink-heading">
              {formatMoney(payment.amount, payment.currency)}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-body">
              This receipt confirms the payment request was completed and recorded by VeloxPay.
            </p>
          </div>

          <ReceiptActions receiptUrl={receiptUrl} explorerUrl={payment.explorerUrl} />
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
          <SummaryItem label="Receipt ID" value={payment.id} />
          <SummaryItem label="Generated" value={formatDate(payment.paidAt || smartRequest?.updatedAt || smartRequest?.createdAt)} />
          <SummaryItem label="Payment mode" value={smartRequest?.mode || "standard"} />
        </div>
      </section>

      <Card className="print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Payment summary</p>
              <h2 className="mt-1 text-xl font-semibold text-ink-heading">Settlement details</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              {payment.status || smartRequest?.onchainStatus || "completed"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="From" value={fromLabel} />
          <SummaryItem label="To" value={toLabel} />
          <SummaryItem label="Amount" value={formatMoney(payment.amount, payment.currency)} />
          <SummaryItem label="Network" value={network} />
          <SummaryItem label="Status" value={payment.status || smartRequest?.onchainStatus || "-"} />
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_0.9fr]">
          <div className="rounded-[24px] border border-line bg-slate-50/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-line">
                <ExternalLink className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink-heading">Transaction</h2>
                <p className="text-sm text-ink-muted">Arc settlement details</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Transaction hash
              </div>
              <div className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs text-ink-heading ring-1 ring-line">
                {payment.transactionHash || "-"}
              </div>
              {payment.explorerUrl ? (
                <a
                  href={payment.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                >
                  View on Arc Explorer
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink-heading">Timeline</h2>
                <p className="text-sm text-ink-muted">Payment confirmation flow</p>
              </div>
            </div>
            <ReceiptTimeline
              timeline={payment.timeline}
              paidAt={payment.paidAt}
              smartRequest={smartRequest}
            />
          </div>
        </section>

        {smartRequest && verification ? (
          <SmartRequestReceiptDetails
            smartRequest={smartRequest}
            paymentTransactionHash={payment.transactionHash || ""}
            paymentExplorerUrl={payment.explorerUrl || ""}
            verification={verification}
          />
        ) : null}
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-ink-heading">{value || "-"}</div>
    </div>
  );
}

function ReceiptTimeline({
  timeline,
  paidAt,
  smartRequest,
}: {
  timeline?: PaymentTimelineEvent[];
  paidAt?: string;
  smartRequest: SmartRequest | null;
}) {
  const firstTimelineDate = timeline?.[0]?.at;
  const initiatedDate = timeline?.find((event) => event.status === "code_requested")?.at || firstTimelineDate;
  const confirmedDate = paidAt || timeline?.find((event) => event.status === "paid")?.at;
  const items = [
    {
      label: "Request created",
      at: smartRequest?.createdAt || firstTimelineDate,
      complete: true,
    },
    {
      label: "Payment initiated",
      at: initiatedDate,
      complete: Boolean(initiatedDate || confirmedDate),
    },
    {
      label: "Payment confirmed",
      at: confirmedDate,
      complete: Boolean(confirmedDate),
    },
    {
      label: "Receipt generated",
      at: confirmedDate || new Date().toISOString(),
      complete: true,
    },
  ];

  return (
    <div className="mt-5 space-y-4">
      {items.map((item, index) => (
        <div key={item.label} className="flex gap-3">
          <div className="mt-0.5 flex flex-col items-center">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
              item.complete ? "bg-brand text-white" : "bg-slate-100 text-slate-400"
            }`}>
              {item.complete ? (
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Circle className="h-3 w-3" aria-hidden="true" />
              )}
            </div>
            {index < items.length - 1 ? <div className="mt-1 h-8 w-px bg-line" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink-heading">{item.label}</div>
            <div className="mt-1 text-xs text-ink-muted">{formatDate(item.at)}</div>
          </div>
        </div>
      ))}
    </div>
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
      <section className={`avoid-break rounded-2xl border p-5 ${
        verification.status === "verified"
          ? "border-emerald-200 bg-emerald-50"
          : verification.status === "failed"
            ? "border-rose-200 bg-rose-50"
            : "border-amber-200 bg-amber-50"
      }`}>
        <div className="text-sm font-semibold text-ink-heading">{verification.label}</div>
        <p className="mt-2 text-sm leading-6 text-ink-body">{verification.reason}</p>
        <div className="mt-4 grid gap-3 text-xs text-ink-body sm:grid-cols-2">
          <HashLine label="Recalculated metadata hash" value={verification.recalculatedMetadataHash} />
          <HashLine label="Contract metadata hash" value={verification.contractMetadataHash || "-"} />
        </div>
      </section>

      <section className="avoid-break rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink-heading">Smart Request details</h2>
        <div className="mt-4 grid gap-4 text-sm text-ink-body sm:grid-cols-2">
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

      <section className="avoid-break rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink-heading">Recipients and settlement</h2>
        <div className="mt-4 space-y-3">
          {smartRequest.recipients.map((recipient, index) => (
            <div key={`${recipient.walletAddress}-${index}`} className="rounded-xl bg-slate-50 p-4 text-sm text-ink-body">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold text-ink-heading">{recipient.name || recipient.email || `Recipient ${index + 1}`}</div>
                  {recipient.role ? <div className="mt-1 text-xs text-ink-muted">{recipient.role}</div> : null}
                  {recipient.email ? <div className="mt-1 text-xs text-ink-muted">{recipient.email}</div> : null}
                </div>
                <div className="text-left sm:text-right">
                  <div>{formatAllocationBps(recipient.allocationBps)}</div>
                  <div className="font-semibold text-ink-heading">{recipient.amount} {smartRequest.currency}</div>
                </div>
              </div>
              <div className="mt-2 break-all font-mono text-xs text-ink-muted">{recipient.walletAddress}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="avoid-break rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink-heading">Transactions and timestamps</h2>
        <div className="mt-4 grid gap-4 text-sm text-ink-body sm:grid-cols-2">
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
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className={`mt-1 break-all text-ink-heading ${mono ? "font-mono text-xs" : ""}`}>{value || "-"}</div>
    </div>
  );
}

function HashLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-ink-heading">{value}</div>
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
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-ink-heading">{hash || "-"}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-semibold text-brand-700 hover:text-brand-hover">
          View on Arc Explorer
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function explorerUrl(hash: string) {
  return hash && hash !== "-" ? `https://testnet.arcscan.app/tx/${hash}` : "";
}
