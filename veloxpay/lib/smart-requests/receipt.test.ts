import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSmartRequestReceiptMetadata,
  buildSmartRequestReceiptVerification,
  formatAllocationBps,
  hashCanonicalJson,
} from "./receipt.ts";
import type { Payment } from "@/lib/types/payment";
import type { SmartRequest } from "@/lib/types/smart-request";

const PAYMENT: Payment = {
  id: "payment-1",
  linkId: "link-1",
  amount: "100",
  currency: "USDC",
  status: "completed",
  payerEmail: "payer@example.com",
  transactionHash: "0x".padEnd(66, "a"),
  explorerUrl: "https://testnet.arcscan.app/tx/0xaaa",
  paidAt: "2026-07-21T12:00:00.000Z",
};

function smartRequest(mode: SmartRequest["mode"], overrides: Partial<SmartRequest> = {}): SmartRequest {
  const request: SmartRequest = {
    id: `smart-${mode}`,
    paymentLinkId: "link-1",
    onchainRequestId: "7",
    externalPaymentId: "0x".padEnd(66, "1"),
    contractAddress: "0x1111111111111111111111111111111111111111",
    chain: "ARC-TESTNET",
    mode,
    currency: "USDC",
    tokenAddress: "0x3600000000000000000000000000000000000000",
    amount: "100",
    amountBaseUnits: "100000000",
    creatorUserId: "creator@example.com",
    creatorWalletId: "wallet-creator",
    creatorWalletAddress: "0x2222222222222222222222222222222222222222",
    expectedPayerEmail: "payer@example.com",
    actualPayerEmail: "payer@example.com",
    actualPayerWalletId: "wallet-payer",
    actualPayerWalletAddress: "0x3333333333333333333333333333333333333333",
    recipients: mode === "split"
      ? [
          {
            name: "Designer",
            role: "design",
            email: "designer@example.com",
            walletAddress: "0x4444444444444444444444444444444444444444",
            allocationBps: 6000,
            amount: "60",
            amountBaseUnits: "60000000",
          },
          {
            name: "Developer",
            role: "build",
            email: "dev@example.com",
            walletAddress: "0x5555555555555555555555555555555555555555",
            allocationBps: 4000,
            amount: "40",
            amountBaseUnits: "40000000",
          },
        ]
      : [
          {
            name: "Creator",
            role: "owner",
            email: "creator@example.com",
            walletAddress: "0x2222222222222222222222222222222222222222",
            allocationBps: 10000,
            amount: "100",
            amountBaseUnits: "100000000",
          },
        ],
    description: "Receipt test",
    dueDate: "2026-08-21T12:00:00.000Z",
    refundEligibilityDate: "2026-08-22T12:00:00.000Z",
    metadataHash: "",
    deliverableUrl: "",
    offchainStatus: mode === "protected" ? "funded" : "settled",
    onchainStatus: mode === "protected" ? "funded" : "settled",
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-21T12:00:00.000Z",
    fundingTransactionHash: PAYMENT.transactionHash,
    ...overrides,
  };

  return {
    ...request,
    metadataHash: overrides.metadataHash || hashCanonicalJson(buildSmartRequestReceiptMetadata(request)),
  };
}

test("verifies standard Smart Request receipt metadata against the contract hash", () => {
  const verification = buildSmartRequestReceiptVerification(PAYMENT, smartRequest("standard"));

  assert.equal(verification?.status, "verified");
  assert.match(verification?.recalculatedMetadataHash || "", /^0x[a-f0-9]{64}$/);
  assert.equal(verification?.recalculatedMetadataHash, verification?.contractMetadataHash);
});

test("verifies split Smart Request receipts and allocation percentages", () => {
  const request = smartRequest("split");
  const verification = buildSmartRequestReceiptVerification(PAYMENT, request);

  assert.equal(verification?.status, "verified");
  assert.equal(request.recipients.length, 2);
  assert.equal(formatAllocationBps(request.recipients[0].allocationBps), "60%");
  assert.equal(formatAllocationBps(request.recipients[1].allocationBps), "40%");
});

test("verifies protected Smart Request receipts with deliverable and release hashes", () => {
  const request = smartRequest("protected", {
    offchainStatus: "settled",
    onchainStatus: "settled",
    deliverableHash: "0x".padEnd(66, "b"),
    releaseTransactionHash: "0x".padEnd(66, "c"),
    deliverableSubmittedAt: "2026-07-21T13:00:00.000Z",
    updatedAt: "2026-07-21T14:00:00.000Z",
  });
  const verification = buildSmartRequestReceiptVerification(PAYMENT, request);

  assert.equal(verification?.status, "verified");
  assert.equal(verification?.timestamps.submitted, "2026-07-21T13:00:00.000Z");
  assert.equal(verification?.timestamps.settled, "2026-07-21T14:00:00.000Z");
});

test("reports pending verification before an onchain request is available", () => {
  const verification = buildSmartRequestReceiptVerification(PAYMENT, smartRequest("standard", {
    onchainRequestId: "",
    onchainStatus: "not_created",
    metadataHash: "",
  }));

  assert.equal(verification?.status, "pending");
});

test("reports failed verification when canonical metadata hash differs", () => {
  const verification = buildSmartRequestReceiptVerification(PAYMENT, smartRequest("split", {
    metadataHash: "0x".padEnd(66, "f"),
  }));

  assert.equal(verification?.status, "failed");
});
