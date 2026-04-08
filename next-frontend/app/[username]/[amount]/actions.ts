"use server";

import { BackendApiError } from "@/lib/api/backend";
import { confirmPaymentForLink, startPaymentForLink } from "@/lib/api/payments";

export type PayActionState = {
  status: "idle" | "code_sent" | "success" | "error";
  message?: string;
  challengeId?: string;
  payerEmail?: string;
  transactionHash?: string;
  explorerUrl?: string;
  createWalletUrl?: string;
};

export async function payForPaymentLink(
  linkId: string,
  previousState: PayActionState,
  formData: FormData,
): Promise<PayActionState> {
  const intent = String(formData.get("intent") || "send-code").trim();
  const payerEmail = String(formData.get("payerEmail") || "").trim();
  const verificationCode = String(formData.get("verificationCode") || "").trim();
  const challengeId = String(formData.get("challengeId") || previousState.challengeId || "").trim();

  if (!payerEmail) {
    return {
      status: "error",
      message: "Enter your email to continue.",
    };
  }

  try {
    if (intent === "confirm-payment") {
      if (!verificationCode) {
        return {
          status: "error",
          message: "Enter the verification code from your email.",
          challengeId,
          payerEmail,
        };
      }

      if (!challengeId) {
        return {
          status: "error",
          message: "Request a verification code first.",
          payerEmail,
        };
      }

      const payment = await confirmPaymentForLink(linkId, {
        payerEmail,
        verificationCode,
        challengeId,
      });

      return {
        status: "success",
        message: "Payment submitted successfully.",
        payerEmail,
        transactionHash: payment.transactionHash,
        explorerUrl: payment.explorerUrl,
      };
    }

    const challenge = await startPaymentForLink(linkId, payerEmail);

    return {
      status: "code_sent",
      message: challenge.message || "We sent a verification code to your email.",
      challengeId: challenge.challengeId,
      payerEmail: challenge.payerEmail || payerEmail,
    };
  } catch (error) {
    if (error instanceof BackendApiError) {
      return {
        status: "error",
        message: error.message,
        challengeId: intent === "confirm-payment" ? challengeId : undefined,
        payerEmail,
        createWalletUrl: typeof error.payload?.createWalletUrl === "string"
          ? error.payload.createWalletUrl
          : undefined,
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to process payment.",
      challengeId: intent === "confirm-payment" ? challengeId : undefined,
      payerEmail,
    };
  }
}
