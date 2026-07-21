import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayButton } from "./pay-button";
import { SmartRequestCheckout } from "./smart-request-checkout";
import type { PaymentLink } from "@/lib/types/payment-link";
import type { SmartRequest } from "@/lib/types/smart-request";
import type { PayActionState } from "@/app/[username]/[amount]/actions";
import { formatMoney } from "@/lib/utils/format";

function formatAllocation(allocationBps: number) {
  const whole = Math.floor(allocationBps / 100);
  const fraction = allocationBps % 100;
  return fraction ? `${whole}.${String(fraction).padStart(2, "0")}%` : `${whole}%`;
}

function paymentModeLabel(mode?: string) {
  if (mode === "split") {
    return "Split Payment";
  }

  if (mode === "protected") {
    return "Protected Payment";
  }

  return "Standard";
}

export function PaymentLinkCard({
  paymentLink,
  payAction,
  smartRequest,
}: {
  paymentLink: PaymentLink;
  payAction: (state: PayActionState, formData: FormData) => Promise<PayActionState>;
  smartRequest?: SmartRequest | null;
}) {
  const payeeName = paymentLink.ownerName || paymentLink.username;
  const paymentMode = smartRequest?.mode || paymentLink.paymentMode || "standard";

  return (
    <Card className="p-8 sm:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="neutral">Payment request</Badge>
        <Badge variant={smartRequest ? "warning" : "neutral"}>{paymentModeLabel(paymentMode)}</Badge>
        <Badge variant={paymentLink.status === "active" ? "success" : "warning"}>
          {paymentLink.status}
        </Badge>
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
        Pay {payeeName}
      </h1>

      <p className="mt-4 text-base leading-7 text-slate-600">
        {paymentLink.description || "This is a secure payment request. Complete it using the wallet flow below."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
        {paymentLink.recurrence?.interval && paymentLink.recurrence.interval !== "one-time" ? (
          <span className="rounded-full bg-slate-100 px-3 py-1">{paymentLink.recurrence.label}</span>
        ) : null}
        {paymentLink.customerName || paymentLink.customerEmail ? (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            For {paymentLink.customerName || paymentLink.customerEmail}
          </span>
        ) : null}
      </div>

      <div className="mt-8 rounded-3xl bg-slate-50 p-6">
        <div className="text-sm text-slate-500">Payment request</div>
        <div className="mt-2 text-4xl font-semibold text-slate-900">
          {formatMoney(paymentLink.amount, paymentLink.currency)}
        </div>
        <div className="mt-3 text-sm text-slate-500">
          Enter your email, confirm the one-time code we send, and approve the payment from one simple flow.
        </div>
      </div>

      {smartRequest ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Payment breakdown</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Review how this Smart Request settles before verifying your email.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>Total: {formatMoney(smartRequest.amount, smartRequest.currency)}</div>
            <div>Mode: {paymentModeLabel(smartRequest.mode)}</div>
            <div>Network: {smartRequest.chain}</div>
            <div>Onchain status: {smartRequest.onchainStatus}</div>
            {smartRequest.dueDate ? <div>Deadline: {new Date(smartRequest.dueDate).toLocaleDateString()}</div> : null}
            {smartRequest.refundEligibilityDate ? (
              <div>Refund eligible: {new Date(smartRequest.refundEligibilityDate).toLocaleDateString()}</div>
            ) : null}
          </div>

          <div className="space-y-2">
            {smartRequest.recipients.map((recipient, index) => (
              <div key={`${recipient.walletAddress}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-900">
                    {recipient.name || recipient.email || `Recipient ${index + 1}`}
                  </span>
                  <span>{formatAllocation(recipient.allocationBps)} - {recipient.amount} {smartRequest.currency}</span>
                </div>
                <div className="mt-1 break-all text-xs text-slate-500">{recipient.walletAddress}</div>
                {recipient.role ? <div className="mt-1 text-xs text-slate-500">{recipient.role}</div> : null}
              </div>
            ))}
          </div>

          {smartRequest.mode === "protected" ? (
            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm font-medium leading-6 text-brand-900">
              The Arc smart contract will hold these funds until the payer approves release after delivery, or until a valid refund path applies.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
        {smartRequest
          ? "This Smart Request uses the Arc contract for settlement, while VeloxPay keeps the email verification and receipt flow familiar."
          : "Why this exists: instead of sharing a wallet address and explaining what to send, the receiver can share one clean payment request with the amount and purpose already filled in."}
      </div>

      <div className="mt-8">
        {smartRequest ? (
          <SmartRequestCheckout paymentLink={paymentLink} smartRequest={smartRequest} />
        ) : (
          <PayButton
            action={payAction}
            username={payeeName}
            linkToken={paymentLink.linkToken}
            linkUsername={paymentLink.username}
            linkAmount={paymentLink.amount}
            linkCurrency={paymentLink.currency}
          />
        )}
      </div>
    </Card>
  );
}
