"use server";

import { createPaymentLink } from "@/lib/api/payment-links";

export type CreateLinkActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  url?: string;
};

export async function createPaymentLinkAction(
  _prevState: CreateLinkActionState,
  formData: FormData,
): Promise<CreateLinkActionState> {
  const amount = String(formData.get("amount") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (amount && Number.isNaN(Number(amount))) {
    return {
      status: "error",
      message: "Amount must be a valid number.",
    };
  }

  try {
    const paymentLink = await createPaymentLink({
      amount: amount || undefined,
      description: description || undefined,
    });

    return {
      status: "success",
      message: "Payment link created successfully.",
      url: paymentLink.url,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to create payment link.",
    };
  }
}
