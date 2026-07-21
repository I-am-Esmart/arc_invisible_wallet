import { backendFetch } from "./backend";
import type { SmartRequestMode, SmartRequestRecipientDraft } from "@/lib/smart-requests/validation";
import type { Payment } from "@/lib/types/payment";
import type { PaymentCurrency } from "@/lib/types/payment-link";
import type { ManagedProtectedSmartRequest, SmartRequest, SmartRequestBridge, SmartRequestResponse } from "@/lib/types/smart-request";
import type { WalletUser } from "@/lib/types/wallet";

export type CreateSmartRequestPayload = {
  amount: string;
  description?: string;
  ownerEmail: string;
  ownerName?: string;
  walletSessionToken?: string;
  currency: PaymentCurrency;
  customerEmail?: string;
  customerName?: string;
  paymentMode: SmartRequestMode;
  recipients: Array<SmartRequestRecipientDraft & { allocationBps: number }>;
  deliverableDescription?: string;
  dueDate?: string;
  refundEligibilityDate?: string;
};

export async function createSmartRequest(payload: CreateSmartRequestPayload) {
  return backendFetch<SmartRequestResponse>("/smart-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type SmartRequestTransaction = {
  id: string;
  state: string;
  txHash: string;
  explorerUrl: string;
  blockchain: string;
  gasSponsorship?: {
    eligible: boolean;
    supportedBlockchain: boolean;
    blockchain: string;
    walletAccountType: string;
    sponsored: boolean;
    confirmed: boolean;
    status: string;
    reason: string;
    feeFlow: "sponsored" | "standard";
    sponsorType?: string;
    paymasterAddress?: string;
    networkFee?: string;
    networkFeeInUSD?: string;
    feeLevel?: string;
  } | null;
};

export type SmartRequestCheckoutResponse = {
  smartRequest: SmartRequest;
  explorerBaseUrl?: string;
  message?: string;
  payer?: WalletUser;
  balance?: {
    balanceBaseUnits: string;
    balance: string;
    hasEnoughBalance: boolean;
  };
  bridge?: SmartRequestBridge | null;
  arcBalanceConfirmed?: boolean;
  allowance?: {
    approvalRequired: boolean;
    allowanceBaseUnits: string;
    estimate?: unknown;
  };
  approval?: SmartRequestTransaction | null;
  approvalSubmitted?: boolean;
  allowanceBaseUnits?: string;
  transaction?: SmartRequestTransaction | null;
  onchainRequest?: {
    status: string;
  };
  completed?: boolean;
  payment?: Payment;
};

export async function getSmartRequestByPaymentLinkId(paymentLinkId: string) {
  return backendFetch<SmartRequestCheckoutResponse>(
    `/smart-requests/payment-link/${encodeURIComponent(paymentLinkId)}`,
  );
}

export async function verifySmartRequestPayer(
  smartRequestId: string,
  payload: {
    payerEmail: string;
    verificationCode: string;
    challengeId: string;
    linkId: string;
    linkToken?: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/verify-payer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkSmartRequestBalance(smartRequestId: string, payerEmail: string) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/check-balance`, {
    method: "POST",
    body: JSON.stringify({ payerEmail }),
  });
}

export async function checkSmartRequestAllowance(smartRequestId: string, payerEmail: string) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/check-allowance`, {
    method: "POST",
    body: JSON.stringify({ payerEmail }),
  });
}

export async function approveSmartRequestToken(
  smartRequestId: string,
  payload: {
    payerEmail: string;
    idempotencyKey: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/approve-token`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function paySmartRequest(
  smartRequestId: string,
  payload: {
    payerEmail: string;
    approvalIdempotencyKey: string;
    paymentIdempotencyKey: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resumeSmartRequestPayment(
  smartRequestId: string,
  payload: {
    payerEmail: string;
    approvalTransactionId?: string;
    paymentTransactionId?: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/resume`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quoteSmartRequestBridge(
  smartRequestId: string,
  payload: {
    payerEmail: string;
    sourceAddress?: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/bridge/quote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function executeSmartRequestBridge(
  smartRequestId: string,
  payload: {
    payerEmail: string;
    sourceAddress?: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/bridge/execute`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resumeSmartRequestBridge(
  smartRequestId: string,
  payload: {
    payerEmail: string;
  },
) {
  return backendFetch<SmartRequestCheckoutResponse>(`/smart-requests/${encodeURIComponent(smartRequestId)}/bridge/resume`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listProtectedSmartRequests(role: "payer" | "payee", email: string) {
  const params = new URLSearchParams({ role, email });
  return backendFetch<{ role: "payer" | "payee"; smartRequests: ManagedProtectedSmartRequest[] }>(
    `/smart-requests/protected?${params.toString()}`,
  );
}

export async function submitProtectedDeliverable(
  smartRequestId: string,
  payload: {
    actorEmail: string;
    deliverableUrl: string;
    note?: string;
    idempotencyKey?: string;
  },
) {
  return backendFetch<{
    smartRequest: ManagedProtectedSmartRequest;
    deliverableRecord: Record<string, unknown>;
    deliverableHash: string;
    transaction: SmartRequestTransaction | null;
  }>(`/smart-requests/${encodeURIComponent(smartRequestId)}/submit-deliverable`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveProtectedRelease(
  smartRequestId: string,
  payload: {
    actorEmail: string;
    idempotencyKey?: string;
  },
) {
  return backendFetch<{
    smartRequest: ManagedProtectedSmartRequest;
    transaction: SmartRequestTransaction | null;
  }>(`/smart-requests/${encodeURIComponent(smartRequestId)}/approve-release`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function claimExpiredProtectedRefund(
  smartRequestId: string,
  payload: {
    actorEmail: string;
    idempotencyKey?: string;
  },
) {
  return backendFetch<{
    smartRequest: ManagedProtectedSmartRequest;
    transaction: SmartRequestTransaction | null;
  }>(`/smart-requests/${encodeURIComponent(smartRequestId)}/claim-expired-refund`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
