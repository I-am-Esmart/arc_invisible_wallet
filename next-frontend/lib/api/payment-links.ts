import { BackendApiError, backendFetch } from "./backend";
import type { PaymentLink } from "@/lib/types/payment-link";

type PaymentLinkPayload = {
  amount?: string;
  description?: string;
};

export async function getPaymentLinkByRoute(username: string, amount: string) {
  try {
    return await backendFetch<PaymentLink | null>(
      `/payment-links/resolve?username=${encodeURIComponent(username)}&amount=${encodeURIComponent(amount)}`,
    );
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function listPaymentLinks() {
  return backendFetch<PaymentLink[]>("/payment-links");
}

export async function createPaymentLink(payload: PaymentLinkPayload) {
  return backendFetch<PaymentLink>("/payment-links", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
