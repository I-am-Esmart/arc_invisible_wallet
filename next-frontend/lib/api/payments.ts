import { backendFetch } from "./backend";
import type { Payment } from "@/lib/types/payment";

type PaymentChallenge = {
  challengeId: string;
  linkToken?: string;
  payerEmail: string;
  message: string;
};

export async function listPayments(filter?: string | { ownerEmail?: string; payerEmail?: string }) {
  const params = new URLSearchParams();
  const ownerEmail = typeof filter === "string" ? filter : filter?.ownerEmail;
  const payerEmail = typeof filter === "string" ? "" : filter?.payerEmail;

  if (ownerEmail) {
    params.set("ownerEmail", ownerEmail);
  }

  if (payerEmail) {
    params.set("payerEmail", payerEmail);
  }

  return backendFetch<Payment[]>(`/payments${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function getPaymentReceipt(paymentId: string) {
  return backendFetch<Payment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function startPaymentForLink(
  linkId: string,
  payload: {
    payerEmail: string;
    linkToken?: string;
    username?: string;
    amount?: string;
    currency?: string;
  },
) {
  return backendFetch<PaymentChallenge>(`/payment-links/${encodeURIComponent(linkId)}/send-code`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmPaymentForLink(
  linkId: string,
  payload: {
    payerEmail: string;
    verificationCode: string;
    challengeId: string;
    linkToken?: string;
    username?: string;
    amount?: string;
    currency?: string;
  },
) {
  return backendFetch<Payment>(`/payment-links/${encodeURIComponent(linkId)}/confirm-payment`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
