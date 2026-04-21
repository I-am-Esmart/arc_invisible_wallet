import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayButton } from "./pay-button";
import type { PaymentLink } from "@/lib/types/payment-link";
import type { PayActionState } from "@/app/[username]/[amount]/actions";
import { formatMoney } from "@/lib/utils/format";

export function PaymentLinkCard({
  paymentLink,
  payAction,
}: {
  paymentLink: PaymentLink;
  payAction: (state: PayActionState, formData: FormData) => Promise<PayActionState>;
}) {
  const payeeName = paymentLink.ownerName || paymentLink.username;

  return (
    <Card className="p-8 sm:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="neutral">Payment link</Badge>
        <Badge variant={paymentLink.status === "active" ? "success" : "warning"}>
          {paymentLink.status}
        </Badge>
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
        Send money to {payeeName}
      </h1>

      <p className="mt-4 text-base leading-7 text-slate-600">
        {paymentLink.description || "Complete this payment using the secure wallet flow."}
      </p>

      <div className="mt-8 rounded-3xl bg-slate-50 p-6">
        <div className="text-sm text-slate-500">Amount due</div>
        <div className="mt-2 text-4xl font-semibold text-slate-900">
          {formatMoney(paymentLink.amount, paymentLink.currency)}
        </div>
        <div className="mt-3 text-sm text-slate-500">
          Enter your email and confirm the one-time code we send before the payment goes through.
        </div>
      </div>

      <div className="mt-8">
        <PayButton action={payAction} username={payeeName} linkToken={paymentLink.linkToken} />
      </div>
    </Card>
  );
}
