import { Badge } from "@/components/ui/badge";

type PaymentStatusProps = {
  status: "idle" | "code_sent" | "success" | "error";
  message?: string;
  transactionHash?: string;
  explorerUrl?: string;
  createWalletUrl?: string;
};

export function PaymentStatus({
  status,
  message,
  transactionHash,
  explorerUrl,
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
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        {message ? <p className="text-sm leading-6 text-slate-700">{message}</p> : null}
      </div>

      {transactionHash ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-800">Transaction hash:</span>{" "}
            <span className="break-all font-mono">{transactionHash}</span>
          </div>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center font-medium text-brand-600 hover:underline"
            >
              View on Arc Explorer
            </a>
          ) : null}
        </div>
      ) : null}

      {createWalletUrl ? (
        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm leading-6 text-slate-700">
            New to VeloxPay? Create your wallet first, then come back here to finish the payment.
          </p>
          <div className="mt-3">
            <a
              href={createWalletUrl}
              className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Create wallet on Arc Wallet
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
