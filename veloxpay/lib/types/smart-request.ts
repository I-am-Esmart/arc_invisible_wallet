import type { PaymentCurrency, PaymentLink } from "@/lib/types/payment-link";
import type { SmartRequestMode } from "@/lib/smart-requests/validation";

export type SmartRequestRecipient = {
  name: string;
  role: string;
  email: string;
  walletAddress: string;
  allocationBps: number;
  amount: string;
  amountBaseUnits: string;
};

export type SmartRequest = {
  id: string;
  paymentLinkId: string;
  onchainRequestId: string;
  externalPaymentId: string;
  contractAddress: string;
  chain: string;
  mode: SmartRequestMode;
  currency: PaymentCurrency;
  tokenAddress: string;
  amount: string;
  amountBaseUnits: string;
  creatorUserId: string;
  creatorWalletId: string;
  creatorWalletAddress: string;
  expectedPayerEmail: string;
  actualPayerEmail?: string;
  actualPayerWalletId?: string;
  actualPayerWalletAddress?: string;
  recipients: SmartRequestRecipient[];
  description: string;
  dueDate: string;
  refundEligibilityDate: string;
  metadataHash: string;
  deliverableUrl: string;
  deliverableNote?: string;
  deliverableSubmittedAt?: string;
  deliverableRecordHash?: string;
  deliverableHash?: string;
  deliverableTransactionId?: string;
  deliverableTransactionHash?: string;
  fundingTransactionId?: string;
  fundingTransactionHash?: string;
  releaseTransactionId?: string;
  releaseTransactionHash?: string;
  refundTransactionId?: string;
  refundTransactionHash?: string;
  bridge?: SmartRequestBridge | null;
  offchainStatus: string;
  onchainStatus: string;
  createdAt: string;
  updatedAt: string;
  error?: {
    code: string;
    message: string;
    at: string;
  };
  recovery?: {
    retryable: boolean;
    attempts: number;
    nextAction: string;
    lastAttemptAt: string;
  };
};

export type SmartRequestBridge = {
  id: string;
  sourceNetwork: string;
  sourceChain: string;
  destinationNetwork: string;
  destinationChain: string;
  token: "USDC";
  sourceAmount: string;
  expectedReceivedAmount: string;
  status: "pending" | "success" | "error" | "recovery_required";
  provider: string;
  quote?: {
    sourceAmount?: string;
    expectedReceivedAmount?: string;
    gasFees?: Array<{ name: string; token: string; blockchain: string; fee: string }>;
    fees?: Array<{ type: string; token: string; amount: string }>;
  } | null;
  steps: Array<{
    name: string;
    status: "pending" | "success" | "error";
    chain: string;
    txHash: string;
    explorerUrl: string;
    forwarded?: boolean;
    batched?: boolean;
    batchId?: string;
  }>;
  events: Array<{
    method: string;
    status: "pending" | "success" | "error";
    chain: string;
    txHash: string;
    explorerUrl: string;
    at: string;
  }>;
  sourceExplorerBaseUrl: string;
  destinationExplorerBaseUrl: string;
  error?: {
    code: string;
    message: string;
    at: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ManagedProtectedSmartRequest = SmartRequest & {
  role: "payer" | "payee";
  timeline?: Array<{
    id: string;
    status: "sent" | "opened" | "code_requested" | "paid" | "failed";
    label: string;
    details?: string;
    at: string;
  }>;
  deliverableRecord?: Record<string, unknown> | null;
  localDeliverableHash?: string;
  hashMatchesOnchain?: boolean;
  permissions: {
    canSubmitDeliverable: boolean;
    canApproveRelease: boolean;
    canClaimExpiredRefund: boolean;
  };
  explorerUrls: {
    funding: string;
    deliverable: string;
    release: string;
    refund: string;
  };
};

export type SmartRequestResponse = {
  paymentLink: PaymentLink;
  smartRequest: SmartRequest;
  estimatedNetworkFee: string;
  contractBehaviour: string;
};
