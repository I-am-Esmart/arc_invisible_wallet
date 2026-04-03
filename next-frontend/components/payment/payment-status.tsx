import { Badge } from "@/components/ui/badge";

type PaymentStatusProps = {
  status: "idle" | "success" | "error";
  message?: string;
  transactionHash?: string;
};

export function PaymentStatus({
  status,
  message,
  transactionHash,
}: PaymentStatusProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <Badge variant={status === "success" ? "success" : "error"}>
          {status === "success" ? "Payment sent" : "Payment failed"}
        </Badge>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>

      {transactionHash ? (
        <div className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Transaction hash:</span>{" "}
          <span className="break-all font-mono">{transactionHash}</span>
        </div>
      ) : null}
    </div>
  );
}
