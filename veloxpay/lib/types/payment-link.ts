export type PaymentLinkStatus = "active" | "inactive" | "expired";
export type PaymentCurrency = "USDC" | "EURC";
export type PaymentTimelineStatus = "sent" | "opened" | "code_requested" | "paid" | "failed";

export type PaymentTimelineEvent = {
  id: string;
  status: PaymentTimelineStatus;
  label: string;
  details?: string;
  at: string;
};

export type PaymentRecurrence = {
  interval: "one-time" | "weekly" | "monthly";
  label?: string;
  nextDueAt?: string;
};

export type PaymentLink = {
  id: string;
  username: string;
  ownerName?: string;
  ownerEmail?: string;
  linkCode?: string;
  linkToken?: string;
  amount: string;
  description?: string;
  currency: PaymentCurrency;
  recurrence?: PaymentRecurrence;
  customerEmail?: string;
  customerName?: string;
  openedCount?: number;
  lastPaidAt?: string;
  timeline?: PaymentTimelineEvent[];
  status: PaymentLinkStatus;
  createdAt?: string;
  url?: string;
};
