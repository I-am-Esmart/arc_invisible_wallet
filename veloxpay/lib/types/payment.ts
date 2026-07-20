import type { PaymentCurrency, PaymentTimelineEvent } from "./payment-link";

export type PaymentStatus = "pending" | "completed" | "failed";

export type Payment = {
  id: string;
  linkId: string;
  linkLabel?: string;
  ownerEmail?: string;
  direction?: "incoming" | "outgoing";
  amount: string;
  currency: PaymentCurrency;
  status: PaymentStatus;
  payerEmail?: string;
  customerName?: string;
  transactionHash?: string;
  explorerUrl?: string;
  memo?: string;
  memoId?: string;
  memoReference?: string;
  memoMode?: string;
  receiptUrl?: string;
  timeline?: PaymentTimelineEvent[];
  paidAt?: string;
};
