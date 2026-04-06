import { backendFetch } from "./backend";
import type { Payment } from "@/lib/types/payment";

export async function listPayments() {
  return backendFetch<Payment[]>("/payments");
}

export async function initiatePaymentForLink(linkId: string, payerEmail: string) {
  return backendFetch<Payment>(`/payment-links/${encodeURIComponent(linkId)}/pay`, {
    method: "POST",
    body: JSON.stringify({ payerEmail }),
  });
}
