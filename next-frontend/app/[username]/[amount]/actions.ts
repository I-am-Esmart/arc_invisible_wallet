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
): Promise<PayActionState> {
  try {
    const payment = await initiatePaymentForLink(linkId);

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
