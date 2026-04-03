export type PaymentLinkStatus = "active" | "inactive" | "expired";
export type PaymentCurrency = "USDC" | "EURC";

export type PaymentLink = {
  id: string;
  username: string;
  amount: string;
  description?: string;
  currency: PaymentCurrency;
  status: PaymentLinkStatus;
  createdAt?: string;
  url?: string;
};
