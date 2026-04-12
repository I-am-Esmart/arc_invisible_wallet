"use server";

import { createPaymentLink } from "@/lib/api/payment-links";
import type { PaymentLink } from "@/lib/types/payment-link";

export type CreateLinkActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  url?: string;
  paymentLink?: PaymentLink;
};

export async function createPaymentLinkAction(
  _prevState: CreateLinkActionState,
  formData: FormData,
): Promise<CreateLinkActionState> {
  const amount = String(formData.get("amount") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const ownerEmail = String(formData.get("ownerEmail") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();

  if (!amount) {
    return {
      status: "error",
      message: "Amount is required.",
    };
  }

  if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return {
      status: "error",
      message: "Amount must be a positive number.",
    };
  }

  if (!ownerEmail) {
    return {
      status: "error",
      message: "Your wallet email is required.",
    };
  }

  try {
    const paymentLink = await createPaymentLink({
      amount,
      description: description || undefined,
      ownerEmail,
      ownerName: ownerName || undefined,
    });

    return {
      status: "success",
      message: "Payment link created successfully.",
      url: paymentLink.url,
      paymentLink,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create payment link.",
    };
  }
}
