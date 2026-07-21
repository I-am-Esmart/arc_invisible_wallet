import { createHash } from "node:crypto";
import type { Payment } from "@/lib/types/payment";
import type { SmartRequest } from "@/lib/types/smart-request";

export type ReceiptVerificationStatus = "verified" | "pending" | "failed";

export type SmartRequestReceiptVerification = {
  status: ReceiptVerificationStatus;
  label: string;
  recalculatedMetadataHash: string;
  contractMetadataHash: string;
  reason: string;
  timestamps: {
    created: string;
    funded: string;
    submitted: string;
    settled: string;
  };
};

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = canonicalize((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function hashCanonicalJson(value: unknown) {
  return `0x${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

export function buildSmartRequestReceiptMetadata(smartRequest: SmartRequest) {
  return {
    id: smartRequest.id,
    paymentLinkId: smartRequest.paymentLinkId || "",
    externalPaymentId: smartRequest.externalPaymentId,
    contractAddress: smartRequest.contractAddress || "",
    chain: smartRequest.chain,
    mode: smartRequest.mode,
    currency: smartRequest.currency,
    tokenAddress: smartRequest.tokenAddress,
    amount: smartRequest.amount,
    amountBaseUnits: smartRequest.amountBaseUnits,
    creatorUserId: smartRequest.creatorUserId,
    creatorWalletId: smartRequest.creatorWalletId,
    creatorWalletAddress: smartRequest.creatorWalletAddress,
    expectedPayerEmail: smartRequest.expectedPayerEmail || "",
    recipients: smartRequest.recipients.map((recipient) => ({
      name: recipient.name,
      role: recipient.role,
      email: recipient.email,
      walletAddress: recipient.walletAddress,
      allocationBps: recipient.allocationBps,
      amount: recipient.amount,
      amountBaseUnits: recipient.amountBaseUnits,
    })),
    description: smartRequest.description || "",
    dueDate: smartRequest.dueDate,
    refundEligibilityDate: smartRequest.refundEligibilityDate || "",
  };
}

export function formatAllocationBps(allocationBps: number) {
  const whole = Math.floor(allocationBps / 100);
  const fraction = allocationBps % 100;
  return fraction ? `${whole}.${String(fraction).padStart(2, "0")}%` : `${whole}%`;
}

export function buildSmartRequestReceiptVerification(
  payment: Payment,
  smartRequest?: SmartRequest | null,
): SmartRequestReceiptVerification | null {
  if (!smartRequest) {
    return null;
  }

  const recalculatedMetadataHash = hashCanonicalJson(buildSmartRequestReceiptMetadata(smartRequest));
  const contractMetadataHash = String(smartRequest.metadataHash || "").toLowerCase();
  const hashMatches = Boolean(contractMetadataHash && recalculatedMetadataHash === contractMetadataHash);
  const isTerminalOrFunded = ["funded", "submitted", "settled", "refunded"].includes(smartRequest.onchainStatus);

  if (!contractMetadataHash || smartRequest.onchainStatus === "not_created" || smartRequest.onchainStatus === "unknown") {
    return {
      status: "pending",
      label: "Pending verification",
      recalculatedMetadataHash,
      contractMetadataHash,
      reason: "The onchain request is not available for full receipt verification yet.",
      timestamps: buildReceiptTimestamps(payment, smartRequest),
    };
  }

  if (!hashMatches) {
    return {
      status: "failed",
      label: "Verification failed",
      recalculatedMetadataHash,
      contractMetadataHash,
      reason: "The recalculated canonical metadata hash does not match the contract metadata hash.",
      timestamps: buildReceiptTimestamps(payment, smartRequest),
    };
  }

  return {
    status: isTerminalOrFunded ? "verified" : "pending",
    label: isTerminalOrFunded
      ? "Verified: receipt details match the onchain record"
      : "Pending verification",
    recalculatedMetadataHash,
    contractMetadataHash,
    reason: isTerminalOrFunded
      ? "The canonical receipt metadata matches the stored onchain metadata hash."
      : "The metadata hash matches, but the request is still waiting for an onchain lifecycle status.",
    timestamps: buildReceiptTimestamps(payment, smartRequest),
  };
}

function buildReceiptTimestamps(payment: Payment, smartRequest: SmartRequest) {
  return {
    created: smartRequest.createdAt || payment.paidAt || "",
    funded: smartRequest.fundingTransactionHash || smartRequest.fundingTransactionId || payment.transactionHash
      ? payment.paidAt || smartRequest.updatedAt || ""
      : "",
    submitted: smartRequest.deliverableSubmittedAt || "",
    settled: smartRequest.releaseTransactionHash || smartRequest.refundTransactionHash || smartRequest.onchainStatus === "settled"
      ? smartRequest.updatedAt || payment.paidAt || ""
      : smartRequest.mode === "standard" || smartRequest.mode === "split"
        ? payment.paidAt || smartRequest.updatedAt || ""
        : "",
  };
}
