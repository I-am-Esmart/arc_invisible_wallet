import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink, ReceiptText, Wallet } from "lucide-react";

type PaymentStatusProps = {
  status: "idle" | "code_sent" | "success" | "error";
  message?: string;
  transactionHash?: string;
  explorerUrl?: string;
  receiptUrl?: string;
  createWalletUrl?: string;
};

export function PaymentStatus({
  status,
  message,
  transactionHash,
  explorerUrl,
  receiptUrl,
  createWalletUrl,
}: PaymentStatusProps) {
  if (status === "idle") {
    return null;
  }

  const badgeVariant =
    status === "success"
      ? "success"
      : status === "code_sent"
        ? "warning"
        : "error";
  const badgeLabel =
    status === "success"
      ? "Payment sent"
      : status === "code_sent"
        ? "Code sent"
        : "Payment paused";

  return (
    <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-brand-50/20 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"
        }`}>
          {status === "success" ? <CheckCircle className="h-6 w-6" aria-hidden="true" /> : <ReceiptText className="h-6 w-6" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          {message ? <p className="mt-2 text-sm leading-6 text-ink-body">{message}</p> : null}
        </div>
      </div>

      {transactionHash ? (
        <div className="mt-5 rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-ink-body shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Transaction hash
          </div>
          <div className="mt-2 break-all font-mono text-xs text-ink-heading">{transactionHash}</div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-50"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                View transaction
              </a>
            ) : <span />}
            {receiptUrl ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-50"
              >
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                View receipt
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {createWalletUrl ? (
        <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <p className="text-sm leading-6 text-ink-body">
            New to VeloxPay? Create your wallet first, then come back here to finish the payment.
          </p>
          <div className="mt-3">
            <a
              href={createWalletUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-button transition hover:bg-brand-hover"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Create wallet on VeloxPay
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
