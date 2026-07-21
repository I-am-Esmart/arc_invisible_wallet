const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ABI_SIGNATURES,
  createSmartRequestContractService,
  waitForCircleTransaction
} = require("../smart-request-contract-service");

const CONTRACT = "0x5555555555555555555555555555555555555555";
const TOKEN = "0x3600000000000000000000000000000000000000";
const WALLET = "0x2222222222222222222222222222222222222222";
const CREATOR = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x3333333333333333333333333333333333333333";
const BYTES32 = `0x${"a".repeat(64)}`;
const METADATA_HASH = `0x${"b".repeat(64)}`;
const DELIVERABLE_HASH = `0x${"c".repeat(64)}`;

function contractRequest(overrides = {}) {
  return {
    request: {
      id: "7",
      externalPaymentId: BYTES32,
      creator: CREATOR,
      payer: overrides.payer || "0x0000000000000000000000000000000000000000",
      token: TOKEN,
      amount: "250000000",
      mode: overrides.mode ?? 0,
      status: overrides.status ?? 0,
      createdAt: "1760000000",
      dueAt: "1760600000",
      metadataHash: METADATA_HASH,
      deliverableHash: overrides.deliverableHash || "0x0000000000000000000000000000000000000000000000000000000000000000"
    },
    recipients: [{ account: RECIPIENT, allocationBps: 10000 }]
  };
}

function createCircleClient({ states = ["COMPLETE"], transactionId = "tx-1", transactionOverrides = {} } = {}) {
  const calls = [];
  const stateQueue = [...states];

  return {
    calls,
    createContractExecutionTransaction: async (input) => {
      calls.push(input);
      return { data: { id: transactionId, state: "INITIATED" } };
    },
    estimateContractExecutionFee: async (input) => {
      calls.push({ estimate: true, ...input });
      return { data: { fee: { type: "level", config: { feeLevel: "MEDIUM" } } } };
    },
    getTransaction: async ({ id }) => {
      const state = stateQueue.length > 1 ? stateQueue.shift() : stateQueue[0];
      return {
        data: {
          transaction: {
            id,
            state,
            blockchain: "ARC-TESTNET",
            txHash: `0x${"1".repeat(64)}`,
            ...transactionOverrides
          }
        }
      };
    }
  };
}

test("waitForCircleTransaction polls until COMPLETE", async () => {
  const circleWalletsClient = createCircleClient({ states: ["QUEUED", "SENT", "COMPLETE"] });
  const result = await waitForCircleTransaction(
    { circleWalletsClient, pollIntervalMs: 0, pollTimeoutMs: 1000, maxPollAttempts: 5 },
    { transactionId: "tx-123" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.id, "tx-123");
  assert.equal(result.data.state, "COMPLETE");
});

test("waitForCircleTransaction returns structured failure for terminal failed states", async () => {
  const circleWalletsClient = createCircleClient({ states: ["FAILED"] });
  const result = await waitForCircleTransaction(
    { circleWalletsClient, pollIntervalMs: 0, pollTimeoutMs: 1000, maxPollAttempts: 1 },
    { transactionId: "tx-failed" }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CIRCLE_TRANSACTION_FAILED");
  assert.equal(result.error.state, "FAILED");
  assert.equal(result.error.transactionId, "tx-failed");
});

test("waitForCircleTransaction confirms Gas Station sponsorship only from explicit Circle fields", async () => {
  const circleWalletsClient = createCircleClient({
    transactionOverrides: {
      gasSponsorship: {
        sponsored: true,
        status: "SPONSORED",
        sponsorType: "GAS_STATION",
        paymasterAddress: "0x7ceA357B5AC0639F89F9e378a1f03Aa5005C0a25"
      }
    }
  });
  const result = await waitForCircleTransaction(
    {
      circleWalletsClient,
      blockchain: "ARC-TESTNET",
      gasStationEnabled: true,
      pollIntervalMs: 0,
      pollTimeoutMs: 1000,
      maxPollAttempts: 1
    },
    {
      transactionId: "tx-sponsored",
      walletId: "wallet-sca",
      walletAccountType: "SCA"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.gasSponsorship.eligible, true);
  assert.equal(result.data.gasSponsorship.sponsored, true);
  assert.equal(result.data.gasSponsorship.confirmed, true);
  assert.equal(result.data.gasSponsorship.feeFlow, "sponsored");
  assert.equal(result.data.gasSponsorship.status, "SPONSORED");
});

test("waitForCircleTransaction marks non-SCA wallets unsupported for Gas Station sponsorship", async () => {
  const result = await waitForCircleTransaction(
    {
      circleWalletsClient: createCircleClient(),
      blockchain: "ARC-TESTNET",
      gasStationEnabled: true,
      pollIntervalMs: 0,
      pollTimeoutMs: 1000,
      maxPollAttempts: 1
    },
    {
      transactionId: "tx-unsupported",
      walletId: "wallet-eoa",
      walletAccountType: "EOA"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.gasSponsorship.eligible, false);
  assert.equal(result.data.gasSponsorship.confirmed, false);
  assert.equal(result.data.gasSponsorship.feeFlow, "standard");
  assert.match(result.data.gasSponsorship.reason, /Smart Contract Account/);
});

test("waitForCircleTransaction falls back to standard Arc fees when Circle does not confirm sponsorship", async () => {
  const result = await waitForCircleTransaction(
    {
      circleWalletsClient: createCircleClient({
        transactionOverrides: {
          gasSponsorship: {
            sponsored: false,
            status: "POLICY_NOT_MATCHED",
            reason: "Policy limit exceeded"
          }
        }
      }),
      blockchain: "ARC-TESTNET",
      gasStationEnabled: true,
      pollIntervalMs: 0,
      pollTimeoutMs: 1000,
      maxPollAttempts: 1
    },
    {
      transactionId: "tx-fallback",
      walletId: "wallet-sca",
      walletAccountType: "SCA"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data.gasSponsorship.eligible, true);
  assert.equal(result.data.gasSponsorship.sponsored, false);
  assert.equal(result.data.gasSponsorship.confirmed, false);
  assert.equal(result.data.gasSponsorship.feeFlow, "standard");
  assert.equal(result.data.gasSponsorship.status, "POLICY_NOT_MATCHED");
});

test("getSmartRequestFromContract maps generated ABI tuple values", async () => {
  const service = createSmartRequestContractService({
    contractAddress: CONTRACT,
    contractReader: async () => contractRequest({ status: 1, mode: 2, payer: WALLET })
  });
  const result = await service.getSmartRequestFromContract({ requestId: "7" });

  assert.equal(result.ok, true);
  assert.equal(result.data.id, "7");
  assert.equal(result.data.mode, "protected");
  assert.equal(result.data.status, "funded");
  assert.equal(result.data.payer, WALLET);
  assert.equal(result.data.amountBaseUnits, "250000000");
  assert.deepEqual(result.data.recipients, [{ account: RECIPIENT, allocationBps: 10000 }]);
});

test("estimateTokenApproval checks allowance and skips fee estimate when sufficient", async () => {
  const circleWalletsClient = createCircleClient();
  const service = createSmartRequestContractService({
    circleWalletsClient,
    contractAddress: CONTRACT,
    allowanceReader: async () => "250000000"
  });
  const result = await service.estimateTokenApproval({
    walletId: "wallet-1",
    walletAddress: WALLET,
    tokenAddress: TOKEN,
    amountBaseUnits: "250000000"
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.approvalRequired, false);
  assert.equal(circleWalletsClient.calls.length, 0);
});

test("approveSmartRequestToken submits exact ERC-20 approve signature when allowance is insufficient", async () => {
  const circleWalletsClient = createCircleClient();
  let allowanceCalls = 0;
  const service = createSmartRequestContractService({
    circleWalletsClient,
    contractAddress: CONTRACT,
    pollIntervalMs: 0,
    allowanceReader: async () => {
      allowanceCalls += 1;
      return allowanceCalls === 1 ? "0" : "250000000";
    }
  });
  const result = await service.approveSmartRequestToken({
    walletId: "wallet-1",
    walletAddress: WALLET,
    tokenAddress: TOKEN,
    amountBaseUnits: "250000000",
    idempotencyKey: "approve-key"
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.approvalSubmitted, true);
  assert.equal(circleWalletsClient.calls[0].idempotencyKey, "approve-key");
  assert.equal(circleWalletsClient.calls[0].contractAddress, TOKEN);
  assert.equal(circleWalletsClient.calls[0].abiFunctionSignature, ABI_SIGNATURES.approve);
  assert.deepEqual(circleWalletsClient.calls[0].abiParameters, [CONTRACT, "250000000"]);
});

test("executeSmartRequestPayment approves first, pays, waits, and verifies settled state", async () => {
  const circleWalletsClient = createCircleClient({ states: ["COMPLETE", "COMPLETE"] });
  let allowanceCalls = 0;
  let requestReads = 0;
  const service = createSmartRequestContractService({
    circleWalletsClient,
    contractAddress: CONTRACT,
    pollIntervalMs: 0,
    allowanceReader: async () => {
      allowanceCalls += 1;
      return allowanceCalls <= 2 ? "0" : "250000000";
    },
    contractReader: async () => {
      requestReads += 1;
      return contractRequest({ status: requestReads === 1 ? 0 : 3 });
    }
  });
  const result = await service.executeSmartRequestPayment({
    walletId: "wallet-1",
    walletAddress: WALLET,
    requestId: "7",
    approvalIdempotencyKey: "approval-key",
    paymentIdempotencyKey: "payment-key"
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.request.status, "settled");
  assert.equal(circleWalletsClient.calls.length, 2);
  assert.equal(circleWalletsClient.calls[0].abiFunctionSignature, ABI_SIGNATURES.approve);
  assert.equal(circleWalletsClient.calls[0].idempotencyKey, "approval-key");
  assert.equal(circleWalletsClient.calls[1].abiFunctionSignature, ABI_SIGNATURES.fundRequest);
  assert.deepEqual(circleWalletsClient.calls[1].abiParameters, ["7"]);
  assert.equal(circleWalletsClient.calls[1].idempotencyKey, "payment-key");
});

test("executeSmartRequestPayment does not report success when contract state is not verified", async () => {
  const service = createSmartRequestContractService({
    circleWalletsClient: createCircleClient(),
    contractAddress: CONTRACT,
    pollIntervalMs: 0,
    allowanceReader: async () => "250000000",
    contractReader: async () => contractRequest({ status: 0 })
  });
  const result = await service.executeSmartRequestPayment({
    walletId: "wallet-1",
    walletAddress: WALLET,
    requestId: "7",
    paymentIdempotencyKey: "payment-key"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "REQUEST_PAYMENT_NOT_VERIFIED");
  assert.equal(result.error.onchainStatus, "open");
});

test("createOnchainSmartRequest uses exact generated createRequest signature", async () => {
  const circleWalletsClient = createCircleClient();
  const service = createSmartRequestContractService({
    circleWalletsClient,
    contractAddress: CONTRACT,
    pollIntervalMs: 0,
    receiptReader: async () => null
  });
  const result = await service.createOnchainSmartRequest({
    walletId: "wallet-1",
    externalPaymentId: BYTES32,
    tokenAddress: TOKEN,
    amountBaseUnits: "250000000",
    mode: "split",
    dueAt: "1760600000",
    metadataHash: METADATA_HASH,
    recipients: [
      { account: RECIPIENT, allocationBps: 7000 },
      { account: "0x4444444444444444444444444444444444444444", allocationBps: 3000 }
    ],
    idempotencyKey: "create-key"
  });

  assert.equal(result.ok, true);
  assert.equal(circleWalletsClient.calls[0].idempotencyKey, "create-key");
  assert.equal(circleWalletsClient.calls[0].abiFunctionSignature, ABI_SIGNATURES.createRequest);
  assert.deepEqual(circleWalletsClient.calls[0].abiParameters, [
    BYTES32,
    TOKEN,
    "250000000",
    1,
    "1760600000",
    METADATA_HASH,
    [
      [RECIPIENT, 7000],
      ["0x4444444444444444444444444444444444444444", 3000]
    ]
  ]);
});

test("protected deliverable, release, refund, and cancel use exact signatures", async () => {
  const circleWalletsClient = createCircleClient({ states: ["COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE"] });
  const verifiedStatuses = [2, 3, 4, 5];
  const service = createSmartRequestContractService({
    circleWalletsClient,
    contractAddress: CONTRACT,
    pollIntervalMs: 0,
    contractReader: async () => contractRequest({ status: verifiedStatuses.shift() })
  });

  assert.equal(
    (await service.submitProtectedDeliverable({
      walletId: "wallet-1",
      requestId: "7",
      deliverableHash: DELIVERABLE_HASH,
      idempotencyKey: "submit-key"
    })).ok,
    true
  );
  assert.equal(
    (await service.approveAndReleaseProtectedPayment({
      walletId: "wallet-1",
      requestId: "7",
      idempotencyKey: "release-key"
    })).ok,
    true
  );
  assert.equal(
    (await service.refundProtectedPayment({
      walletId: "wallet-1",
      requestId: "7",
      refundMode: "expired",
      idempotencyKey: "refund-key"
    })).ok,
    true
  );
  assert.equal(
    (await service.cancelOnchainSmartRequest({
      walletId: "wallet-1",
      requestId: "7",
      idempotencyKey: "cancel-key"
    })).ok,
    true
  );

  assert.equal(circleWalletsClient.calls[0].abiFunctionSignature, ABI_SIGNATURES.submitDeliverable);
  assert.deepEqual(circleWalletsClient.calls[0].abiParameters, ["7", DELIVERABLE_HASH]);
  assert.equal(circleWalletsClient.calls[1].abiFunctionSignature, ABI_SIGNATURES.approveProtectedRequest);
  assert.equal(circleWalletsClient.calls[2].abiFunctionSignature, ABI_SIGNATURES.refundExpiredProtected);
  assert.equal(circleWalletsClient.calls[3].abiFunctionSignature, ABI_SIGNATURES.cancelRequest);
});
