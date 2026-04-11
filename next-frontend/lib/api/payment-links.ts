import { BackendApiError, backendFetch } from "./backend";
import type { PaymentLink } from "@/lib/types/payment-link";

type PaymentLinkPayload = {
  amount?: string;
  description?: string;
  ownerEmail?: string;
  ownerName?: string;
};

export async function getPaymentLinkByRoute(username?: string, amount?: string, linkId?: string) {
  try {
    const params = new URLSearchParams();

    if (username) {
      params.set("username", username);
    }

    if (amount) {
      params.set("amount", amount);
    }

    if (linkId) {
      params.set("linkId", linkId);
    }

    return await backendFetch<PaymentLink | null>(
      `/payment-links/resolve?${params.toString()}`,
    );
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function listPaymentLinks(ownerEmail?: string) {
  const params = new URLSearchParams();

  if (ownerEmail) {
    params.set("ownerEmail", ownerEmail);
  }

  return backendFetch<PaymentLink[]>(`/payment-links${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function createPaymentLink(payload: PaymentLinkPayload) {
  return backendFetch<PaymentLink>("/payment-links", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
