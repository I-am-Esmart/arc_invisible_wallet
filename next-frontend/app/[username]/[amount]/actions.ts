"use server";

import { initiatePaymentForLink } from "@/lib/api/payments";

export type PayActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  transactionHash?: string;
};

export async function payForPaymentLink(
  linkId: string,
  _prevState: PayActionState,
  formData: FormData,
): Promise<PayActionState> {
  const payerEmail = String(formData.get("payerEmail") || "").trim();

  if (!payerEmail) {
    return {
      status: "error",
      message: "Enter your email to continue.",
    };
  }

  try {
    const payment = await initiatePaymentForLink(linkId, payerEmail);

    return {
      status: "success",
      message: "Payment submitted successfully.",
      transactionHash: payment.transactionHash,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to process payment.",
    };
  }
}
