import type { PaymentCurrency } from "./payment-link";

export type PaymentStatus = "pending" | "completed" | "failed";

export type Payment = {
  id: string;
  linkId: string;
  linkLabel?: string;
  amount: string;
  currency: PaymentCurrency;
  status: PaymentStatus;
  transactionHash?: string;
  explorerUrl?: string;
  paidAt?: string;
};
