const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");

const TERMINAL_TRANSACTION_STATES = new Set(["COMPLETE", "FAILED", "CANCELLED", "DENIED"]);
const SUCCESS_TRANSACTION_STATE = "COMPLETE";
const DEFAULT_CHAIN = "ARC-TESTNET";
const DEFAULT_FEE_LEVEL = "MEDIUM";
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_TIMEOUT_MS = 120000;
const DEFAULT_MAX_POLL_ATTEMPTS = 40;
const MODE_NAMES = ["standard", "split", "protected"];
const STATUS_NAMES = ["open", "funded", "submitted", "settled", "refunded", "cancelled"];
const GAS_SPONSORSHIP_SUPPORTED_BLOCKCHAINS = new Set(["ARC-TESTNET"]);
const GAS_SPONSORSHIP_SUCCESS_STATUSES = new Set(["SPONSORED", "APPLIED", "SUCCESS", "SUCCESSFUL", "COMPLETE", "COMPLETED"]);
const MODE_VALUES = {
  standard: 0,
  split: 1,
  protected: 2
};
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)"
];
const ABI_SIGNATURES = {
  createRequest: "createRequest(bytes32,address,uint256,uint8,uint64,bytes32,(address,uint16)[])",
  fundRequest: "fundRequest(uint256)",
  submitDeliverable: "submitDeliverable(uint256,bytes32)",
  approveProtectedRequest: "approveProtectedRequest(uint256)",
  refundProtectedByCreator: "refundProtectedByCreator(uint256)",
  refundExpiredProtected: "refundExpiredProtected(uint256)",
  cancelRequest: "cancelRequest(uint256)",
  approve: "approve(address,uint256)"
};

const buildArtifactPath = path.resolve(
  __dirname,
  "..",
  "..",
  "contracts",
  "deployments",
  "arc-testnet",
  "VeloxPayRequests.build.json"
);
const generatedArtifact = JSON.parse(fs.readFileSync(buildArtifactPath, "utf8"));
const VELOXPAY_REQUESTS_ABI = generatedArtifact.abi;
const VELOXPAY_REQUESTS_INTERFACE = new ethers.Interface(VELOXPAY_REQUESTS_ABI);

function createSmartRequestContractService(context) {
  return {
    getSmartRequestFromContract: (input) => getSmartRequestFromContract(context, input),
    createOnchainSmartRequest: (input) => createOnchainSmartRequest(context, input),
    estimateTokenApproval: (input) => estimateTokenApproval(context, input),
    approveSmartRequestToken: (input) => approveSmartRequestToken(context, input),
    estimateSmartRequestPayment: (input) => estimateSmartRequestPayment(context, input),
    executeSmartRequestPayment: (input) => executeSmartRequestPayment(context, input),
    submitProtectedDeliverable: (input) => submitProtectedDeliverable(context, input),
    approveAndReleaseProtectedPayment: (input) => approveAndReleaseProtectedPayment(context, input),
    refundProtectedPayment: (input) => refundProtectedPayment(context, input),
    cancelOnchainSmartRequest: (input) => cancelOnchainSmartRequest(context, input),
    waitForCircleTransaction: (input) => waitForCircleTransaction(context, input),
    findSmartRequestSettlementTransaction: (input) => safeContractCall(() => findSmartRequestSettlementTransaction(context, input))
  };
}

async function getSmartRequestFromContract(context, input) {
  return safeContractCall(async () => {
    return getSmartRequestFromContractRaw(context, input);
  });
}

async function createOnchainSmartRequest(context, input) {
  return safeContractCall(async () => {
    const contractAddress = requireAddress(resolveContractAddress(context, input), "Contract address");
    const walletId = nonEmptyString(input.walletId, "Circle wallet ID");
    const idempotencyKey = resolveIdempotencyKey(input.idempotencyKey);
    const mode = normalizeMode(input.mode);
    const amountBaseUnits = normalizeBaseUnits(input.amountBaseUnits, "Amount base units");
    const dueAt = normalizeUint64(input.dueAt, "Due timestamp");
    const recipients = normalizeContractRecipients(input.recipients);

    const transaction = await submitCircleContractTransactionRaw(context, {
      walletId,
      contractAddress,
      abiFunctionSignature: ABI_SIGNATURES.createRequest,
      abiParameters: [
        requireBytes32(input.externalPaymentId, "External payment ID"),
        requireAddress(input.tokenAddress, "Token address"),
        amountBaseUnits,
        MODE_VALUES[mode],
        dueAt,
        requireBytes32(input.metadataHash, "Metadata hash"),
        recipients.map((recipient) => [recipient.account, recipient.allocationBps])
      ],
      idempotencyKey,
      refId: input.refId || "veloxpay-smart-request-create",
      walletAccountType: input.walletAccountType
    });

    const requestCreated = await readRequestCreatedEvent(context, transaction.txHash);

    return {
      transaction,
      contractAddress,
      onchainRequestId: requestCreated?.requestId || "",
      externalPaymentId: input.externalPaymentId,
      mode,
      onchainStatus: requestCreated?.requestId
        ? (await getSmartRequestFromContractRaw(context, { contractAddress, requestId: requestCreated.requestId })).status
        : "unknown"
    };
  });
}

async function estimateTokenApproval(context, input) {
  return safeContractCall(async () => {
    const walletId = nonEmptyString(input.walletId, "Circle wallet ID");
    const walletAddress = requireAddress(input.walletAddress, "Wallet address");
    const tokenAddress = requireAddress(input.tokenAddress, "Token address");
    const spenderAddress = requireAddress(input.spenderAddress || resolveContractAddress(context, input), "Spender address");
    const amountBaseUnits = normalizeBaseUnits(input.amountBaseUnits, "Amount base units");
    const allowance = await getTokenAllowanceRaw(context, { tokenAddress, ownerAddress: walletAddress, spenderAddress });

    if (allowance >= BigInt(amountBaseUnits)) {
      return {
        approvalRequired: false,
        allowanceBaseUnits: allowance.toString(),
        estimate: null
      };
    }

    const estimate = await estimateCircleContractExecutionRaw(context, {
      walletId,
      contractAddress: tokenAddress,
      abiFunctionSignature: ABI_SIGNATURES.approve,
      abiParameters: [spenderAddress, amountBaseUnits],
      walletAccountType: input.walletAccountType
    });

    return {
      approvalRequired: true,
      allowanceBaseUnits: allowance.toString(),
      estimate
    };
  });
}

async function approveSmartRequestToken(context, input) {
  return safeContractCall(async () => {
    const walletId = nonEmptyString(input.walletId, "Circle wallet ID");
    const walletAddress = requireAddress(input.walletAddress, "Wallet address");
    const tokenAddress = requireAddress(input.tokenAddress, "Token address");
    const spenderAddress = requireAddress(input.spenderAddress || resolveContractAddress(context, input), "Spender address");
    const amountBaseUnits = normalizeBaseUnits(input.amountBaseUnits, "Amount base units");
    const allowance = await getTokenAllowanceRaw(context, { tokenAddress, ownerAddress: walletAddress, spenderAddress });

    if (allowance >= BigInt(amountBaseUnits)) {
      return {
        approvalSubmitted: false,
        allowanceBaseUnits: allowance.toString(),
        transaction: null
      };
    }

    const transaction = await submitCircleContractTransactionRaw(context, {
      walletId,
      contractAddress: tokenAddress,
      abiFunctionSignature: ABI_SIGNATURES.approve,
      abiParameters: [spenderAddress, amountBaseUnits],
      idempotencyKey: resolveIdempotencyKey(input.idempotencyKey),
      refId: input.refId || "veloxpay-smart-request-token-approval",
      walletAccountType: input.walletAccountType
    });

    const verifiedAllowance = await getTokenAllowanceRaw(context, { tokenAddress, ownerAddress: walletAddress, spenderAddress });
    if (verifiedAllowance < BigInt(amountBaseUnits)) {
      throw new SmartRequestContractError("TOKEN_APPROVAL_NOT_VERIFIED", "Token approval completed but allowance is still insufficient.", {
        retryable: true,
        transactionId: transaction.id
      });
    }

    return {
      approvalSubmitted: true,
      allowanceBaseUnits: verifiedAllowance.toString(),
      transaction
    };
  });
}

async function estimateSmartRequestPayment(context, input) {
  return safeContractCall(async () => {
    const walletId = nonEmptyString(input.walletId, "Circle wallet ID");
    const walletAddress = requireAddress(input.walletAddress, "Wallet address");
    const contractAddress = requireAddress(resolveContractAddress(context, input), "Contract address");
    const request = await getSmartRequestFromContractRaw(context, { contractAddress, requestId: input.requestId });
    const allowance = await getTokenAllowanceRaw(context, {
      tokenAddress: request.tokenAddress,
      ownerAddress: walletAddress,
      spenderAddress: contractAddress
    });
    const estimate = await estimateCircleContractExecutionRaw(context, {
      walletId,
      contractAddress,
      abiFunctionSignature: ABI_SIGNATURES.fundRequest,
      abiParameters: [request.id],
      walletAccountType: input.walletAccountType
    });

    return {
      approvalRequired: allowance < BigInt(request.amountBaseUnits),
      allowanceBaseUnits: allowance.toString(),
      amountBaseUnits: request.amountBaseUnits,
      tokenAddress: request.tokenAddress,
      estimate
    };
  });
}

async function executeSmartRequestPayment(context, input) {
  return safeContractCall(async () => {
    const walletId = nonEmptyString(input.walletId, "Circle wallet ID");
    const walletAddress = requireAddress(input.walletAddress, "Wallet address");
    const contractAddress = requireAddress(resolveContractAddress(context, input), "Contract address");
    const request = await getSmartRequestFromContractRaw(context, { contractAddress, requestId: input.requestId });

    if (request.status !== "open") {
      throw new SmartRequestContractError("REQUEST_NOT_OPEN", "Smart request is not open for payment.", { retryable: false });
    }

    let approval = null;
    const allowance = await getTokenAllowanceRaw(context, {
      tokenAddress: request.tokenAddress,
      ownerAddress: walletAddress,
      spenderAddress: contractAddress
    });

    if (allowance < BigInt(request.amountBaseUnits)) {
      approval = await approveSmartRequestTokenRaw(context, {
        walletId,
        walletAddress,
        tokenAddress: request.tokenAddress,
        spenderAddress: contractAddress,
        amountBaseUnits: request.amountBaseUnits,
        idempotencyKey: resolveIdempotencyKey(input.approvalIdempotencyKey),
        refId: input.approvalRefId || "veloxpay-smart-request-pay-approval",
        walletAccountType: input.walletAccountType
      });
    }

    const transaction = await submitCircleContractTransactionRaw(context, {
      walletId,
      contractAddress,
      abiFunctionSignature: ABI_SIGNATURES.fundRequest,
      abiParameters: [request.id],
      idempotencyKey: resolveIdempotencyKey(input.paymentIdempotencyKey || input.idempotencyKey),
      refId: input.refId || "veloxpay-smart-request-payment",
      walletAccountType: input.walletAccountType
    });
    const verifiedRequest = await getSmartRequestFromContractRaw(context, { contractAddress, requestId: request.id });
    const expectedStatus = request.mode === "protected" ? "funded" : "settled";

    if (verifiedRequest.status !== expectedStatus) {
      throw new SmartRequestContractError(
        "REQUEST_PAYMENT_NOT_VERIFIED",
        "Payment transaction completed, but contract state did not reach the expected status.",
        {
          retryable: true,
          transactionId: transaction.id,
          onchainStatus: verifiedRequest.status
        }
      );
    }

    return {
      approval,
      transaction,
      request: verifiedRequest
    };
  });
}

async function submitProtectedDeliverable(context, input) {
  return executeAndVerifyRequestStatus(context, input, {
    signature: ABI_SIGNATURES.submitDeliverable,
    parameters: [normalizeOnchainRequestId(input.requestId), requireBytes32(input.deliverableHash, "Deliverable hash")],
    expectedStatus: "submitted",
    defaultRefId: "veloxpay-smart-request-submit-deliverable"
  });
}

async function approveAndReleaseProtectedPayment(context, input) {
  return executeAndVerifyRequestStatus(context, input, {
    signature: ABI_SIGNATURES.approveProtectedRequest,
    parameters: [normalizeOnchainRequestId(input.requestId)],
    expectedStatus: "settled",
    defaultRefId: "veloxpay-smart-request-release"
  });
}

async function refundProtectedPayment(context, input) {
  const refundMode = String(input.refundMode || input.mode || "creator").trim().toLowerCase();
  const signature = refundMode === "expired" ? ABI_SIGNATURES.refundExpiredProtected : ABI_SIGNATURES.refundProtectedByCreator;

  return executeAndVerifyRequestStatus(context, input, {
    signature,
    parameters: [normalizeOnchainRequestId(input.requestId)],
    expectedStatus: "refunded",
    defaultRefId: refundMode === "expired" ? "veloxpay-smart-request-expired-refund" : "veloxpay-smart-request-creator-refund"
  });
}

async function cancelOnchainSmartRequest(context, input) {
  return executeAndVerifyRequestStatus(context, input, {
    signature: ABI_SIGNATURES.cancelRequest,
    parameters: [normalizeOnchainRequestId(input.requestId)],
    expectedStatus: "cancelled",
    defaultRefId: "veloxpay-smart-request-cancel"
  });
}

async function waitForCircleTransaction(context, input) {
  return safeContractCall(async () => waitForCircleTransactionRaw(context, input));
}

async function executeAndVerifyRequestStatus(context, input, { signature, parameters, expectedStatus, defaultRefId }) {
  return safeContractCall(async () => {
    const walletId = nonEmptyString(input.walletId, "Circle wallet ID");
    const contractAddress = requireAddress(resolveContractAddress(context, input), "Contract address");
    const transaction = await submitCircleContractTransactionRaw(context, {
      walletId,
      contractAddress,
      abiFunctionSignature: signature,
      abiParameters: parameters,
      idempotencyKey: resolveIdempotencyKey(input.idempotencyKey),
      refId: input.refId || defaultRefId,
      walletAccountType: input.walletAccountType
    });
    const request = await getSmartRequestFromContractRaw(context, { contractAddress, requestId: input.requestId });

    if (request.status !== expectedStatus) {
      throw new SmartRequestContractError(
        "REQUEST_STATE_NOT_VERIFIED",
        "Transaction completed, but contract state did not reach the expected status.",
        {
          retryable: true,
          transactionId: transaction.id,
          onchainStatus: request.status
        }
      );
    }

    return {
      transaction,
      request
    };
  });
}

async function approveSmartRequestTokenRaw(context, input) {
  const result = await approveSmartRequestToken(context, input);
  if (!result.ok) {
    throw safeErrorToException(result.error);
  }
  return result.data;
}

async function submitCircleContractTransactionRaw(context, input) {
  const circleWalletsClient = requireCircleWalletsClient(context);
  const gasSponsorshipEligibility = resolveGasSponsorshipEligibility(context, input);
  const response = await circleWalletsClient.createContractExecutionTransaction({
    idempotencyKey: nonEmptyString(input.idempotencyKey, "Circle idempotency key"),
    walletId: input.walletId,
    contractAddress: input.contractAddress,
    abiFunctionSignature: input.abiFunctionSignature,
    abiParameters: input.abiParameters,
    fee: resolveFee(context, input),
    refId: input.refId
  });
  const transactionId = response?.data?.id;

  if (!transactionId) {
    throw new SmartRequestContractError("CIRCLE_TRANSACTION_MISSING_ID", "Circle did not return a transaction ID.", {
      retryable: true
    });
  }

  return waitForCircleTransactionRaw(context, {
    transactionId,
    gasSponsorshipEligibility,
    refId: input.refId,
    walletId: input.walletId
  });
}

async function estimateCircleContractExecutionRaw(context, input) {
  const circleWalletsClient = requireCircleWalletsClient(context);

  if (typeof circleWalletsClient.estimateContractExecutionFee !== "function") {
    throw new SmartRequestContractError("CIRCLE_ESTIMATE_UNAVAILABLE", "Circle fee estimation is unavailable.", {
      retryable: false
    });
  }

  const response = await circleWalletsClient.estimateContractExecutionFee({
    walletId: input.walletId,
    contractAddress: input.contractAddress,
    abiFunctionSignature: input.abiFunctionSignature,
    abiParameters: input.abiParameters
  });

  return {
    ...(response?.data || response),
    gasSponsorship: resolveGasSponsorshipEligibility(context, input)
  };
}

async function waitForCircleTransactionRaw(context, input) {
  const circleWalletsClient = requireCircleWalletsClient(context);
  const transactionId = nonEmptyString(input.transactionId, "Circle transaction ID");
  const intervalMs = Number(input.pollIntervalMs ?? context.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  const timeoutMs = Number(input.pollTimeoutMs ?? context.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS);
  const maxAttempts = Number(input.maxAttempts ?? context.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS);
  const gasSponsorshipEligibility = input.gasSponsorshipEligibility || resolveGasSponsorshipEligibility(context, input);
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxAttempts && Date.now() - startedAt <= timeoutMs; attempt += 1) {
    const response = await circleWalletsClient.getTransaction({ id: transactionId });
    const transaction = response?.data?.transaction;

    if (transaction?.state && TERMINAL_TRANSACTION_STATES.has(transaction.state)) {
      if (transaction.state !== SUCCESS_TRANSACTION_STATE) {
        throw new SmartRequestContractError("CIRCLE_TRANSACTION_FAILED", "Circle transaction ended in a terminal failure state.", {
          retryable: false,
          state: transaction.state,
          transactionId
        });
      }

      const normalizedTransaction = normalizeCircleTransaction(transaction, gasSponsorshipEligibility);
      logGasSponsorshipResult(context, normalizedTransaction.gasSponsorship, {
        transactionId,
        refId: input.refId,
        walletId: input.walletId || ""
      });
      return normalizedTransaction;
    }

    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  throw new SmartRequestContractError("CIRCLE_TRANSACTION_TIMEOUT", "Circle transaction polling timed out.", {
    retryable: true,
    transactionId
  });
}

async function getSmartRequestFromContractRaw(context, input) {
  const contractAddress = requireAddress(resolveContractAddress(context, input), "Contract address");
  const requestId = normalizeOnchainRequestId(input.requestId || input.onchainRequestId);

  if (typeof context.contractReader === "function") {
    return normalizeContractRequest(await context.contractReader({ contractAddress, requestId }));
  }

  const provider = requireProvider(context);
  const contract = new ethers.Contract(contractAddress, VELOXPAY_REQUESTS_ABI, provider);

  // Circle submits writes through its own relayer infra, while reads go through our own RPC
  // node - the two can briefly disagree on the chain tip right after a request is created or
  // settled. A bare "call exception" here (no decodable revert reason) almost always means the
  // node just hasn't caught up yet, so retry a few times before giving up.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const [request, recipients] = await Promise.all([contract.getRequest(requestId), contract.getRecipients(requestId)]);
      return normalizeContractRequest({ request, recipients });
    } catch (error) {
      if (error?.code !== "CALL_EXCEPTION" || attempt === maxAttempts) {
        if (error?.code === "CALL_EXCEPTION") {
          throw new SmartRequestContractError(
            "REQUEST_NOT_YET_VISIBLE",
            "This Smart Request was just created or updated and is still confirming on Arc. Please try again in a few seconds.",
            { retryable: true }
          );
        }
        throw error;
      }
      await sleep(1500 * attempt);
    }
  }
}

// Recovery paths (eg. resuming after a dropped connection) sometimes only know that a request
// settled onchain, not which Circle transaction did it. This looks up the actual settlement
// event log so the real transaction hash can be shown instead of being left blank.
async function findSmartRequestSettlementTransaction(context, { contractAddress, requestId, mode }) {
  const provider = requireProvider(context);
  const contract = new ethers.Contract(requireAddress(contractAddress, "Contract address"), VELOXPAY_REQUESTS_ABI, provider);
  const normalizedRequestId = normalizeOnchainRequestId(requestId);
  const eventName = mode === "protected" ? "RequestFunded" : "RequestSettled";
  const filter = contract.filters[eventName](normalizedRequestId);
  const latestBlock = await provider.getBlockNumber();

  for (const lookbackBlocks of [5000, 100000]) {
    try {
      const logs = await contract.queryFilter(filter, Math.max(0, latestBlock - lookbackBlocks), latestBlock);
      if (logs.length > 0) {
        const mostRecent = logs[logs.length - 1];
        return { txHash: mostRecent.transactionHash, blockNumber: mostRecent.blockNumber };
      }
    } catch {
      // Try the wider window below, or fall through and report nothing found.
    }
  }

  return null;
}

async function getTokenAllowanceRaw(context, { tokenAddress, ownerAddress, spenderAddress }) {
  if (typeof context.allowanceReader === "function") {
    return BigInt(
      normalizeNonNegativeBaseUnits(
        await context.allowanceReader({ tokenAddress, ownerAddress, spenderAddress }),
        "Allowance base units"
      )
    );
  }

  const provider = requireProvider(context);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  return BigInt((await token.allowance(ownerAddress, spenderAddress)).toString());
}

async function readRequestCreatedEvent(context, txHash) {
  if (!txHash) {
    return null;
  }

  const receipt = await readTransactionReceipt(context, txHash);
  if (!receipt?.logs) {
    return null;
  }

  for (const log of receipt.logs) {
    try {
      const parsed = VELOXPAY_REQUESTS_INTERFACE.parseLog(log);
      if (parsed?.name === "RequestCreated") {
        return {
          requestId: parsed.args.requestId.toString(),
          externalPaymentId: String(parsed.args.externalPaymentId)
        };
      }
    } catch {
      // Ignore unrelated logs in the deployment transaction receipt.
    }
  }

  return null;
}

async function readTransactionReceipt(context, txHash) {
  if (typeof context.receiptReader === "function") {
    return context.receiptReader(txHash);
  }

  const provider = context.provider;
  if (!provider || typeof provider.getTransactionReceipt !== "function") {
    return null;
  }

  return provider.getTransactionReceipt(txHash);
}

function normalizeContractRequest({ request, recipients }) {
  const rawRequest = request || {};
  const id = readTupleValue(rawRequest, "id", 0).toString();
  const modeIndex = Number(readTupleValue(rawRequest, "mode", 6));
  const statusIndex = Number(readTupleValue(rawRequest, "status", 7));

  return {
    id,
    onchainRequestId: id,
    externalPaymentId: String(readTupleValue(rawRequest, "externalPaymentId", 1)),
    creator: ethers.getAddress(String(readTupleValue(rawRequest, "creator", 2))),
    payer: normalizeOptionalContractAddress(readTupleValue(rawRequest, "payer", 3)),
    tokenAddress: ethers.getAddress(String(readTupleValue(rawRequest, "token", 4))),
    amountBaseUnits: readTupleValue(rawRequest, "amount", 5).toString(),
    mode: MODE_NAMES[modeIndex] || "unknown",
    status: STATUS_NAMES[statusIndex] || "unknown",
    createdAt: Number(readTupleValue(rawRequest, "createdAt", 8)),
    dueAt: Number(readTupleValue(rawRequest, "dueAt", 9)),
    metadataHash: String(readTupleValue(rawRequest, "metadataHash", 10)).toLowerCase(),
    deliverableHash: String(readTupleValue(rawRequest, "deliverableHash", 11)).toLowerCase(),
    recipients: (recipients || []).map((recipient) => ({
      account: ethers.getAddress(String(readTupleValue(recipient, "account", 0))),
      allocationBps: Number(readTupleValue(recipient, "allocationBps", 1))
    }))
  };
}

function normalizeCircleTransaction(transaction, gasSponsorshipEligibility = null) {
  return {
    id: transaction.id,
    state: transaction.state,
    txHash: transaction.txHash || transaction.transactionHash || "",
    blockchain: transaction.blockchain || DEFAULT_CHAIN,
    errorReason: transaction.errorReason || "",
    errorDetails: transaction.errorDetails || "",
    gasSponsorship: normalizeGasSponsorship(transaction, gasSponsorshipEligibility)
  };
}

function normalizeGasSponsorship(transaction, gasSponsorshipEligibility = null) {
  const eligibility = gasSponsorshipEligibility || resolveGasSponsorshipEligibility({}, {
    blockchain: transaction.blockchain
  });
  const explicit = readExplicitGasSponsorship(transaction);
  const sponsored = explicit.sponsored === true;
  const confirmed = sponsored && transaction.state === SUCCESS_TRANSACTION_STATE;

  return {
    eligible: Boolean(eligibility.eligible),
    supportedBlockchain: Boolean(eligibility.supportedBlockchain),
    blockchain: eligibility.blockchain || transaction.blockchain || DEFAULT_CHAIN,
    walletAccountType: eligibility.walletAccountType || "",
    sponsored,
    confirmed,
    status: explicit.status,
    reason: eligibility.eligible ? explicit.reason || eligibility.reason : eligibility.reason || explicit.reason,
    feeFlow: confirmed ? "sponsored" : "standard",
    sponsorType: explicit.sponsorType,
    paymasterAddress: explicit.paymasterAddress,
    networkFee: stringifyOptional(transaction.networkFee || transaction.networkFees || transaction.estimatedFee?.networkFee),
    networkFeeInUSD: stringifyOptional(transaction.networkFeeInUSD || transaction.estimatedFee?.networkFeeInUSD),
    feeLevel: stringifyOptional(transaction.feeLevel || transaction.estimatedFee?.feeLevel)
  };
}

function readExplicitGasSponsorship(transaction) {
  const candidates = [
    transaction.gasSponsorship,
    transaction.gas_sponsorship,
    transaction.sponsorship,
    transaction.gasStation,
    transaction.gas_station,
    transaction.feeSponsorship,
    transaction.fee_sponsorship
  ].filter(Boolean);

  for (const candidate of candidates) {
    const sponsoredValue = candidate.sponsored ?? candidate.isSponsored ?? candidate.applied ?? candidate.enabled;
    const status = stringifyOptional(candidate.status || candidate.state || candidate.result).toUpperCase();
    const sponsored = sponsoredValue === true || GAS_SPONSORSHIP_SUCCESS_STATUSES.has(status);

    if (sponsoredValue !== undefined || status) {
      return {
        sponsored,
        status: status || (sponsored ? "SPONSORED" : "NOT_SPONSORED"),
        reason: stringifyOptional(candidate.reason || candidate.failureReason || candidate.errorReason),
        sponsorType: stringifyOptional(candidate.sponsorType || candidate.type || "gas-station"),
        paymasterAddress: stringifyOptional(candidate.paymasterAddress || candidate.paymaster || candidate.feePayerAddress)
      };
    }
  }

  return {
    sponsored: false,
    status: "",
    reason: "Circle transaction response did not include explicit Gas Station sponsorship confirmation.",
    sponsorType: "",
    paymasterAddress: ""
  };
}

function resolveGasSponsorshipEligibility(context = {}, input = {}) {
  const blockchain = resolveTransactionBlockchain(context, input);
  const walletAccountType = normalizeWalletAccountType(input.walletAccountType || input.accountType || context.walletAccountType || context.accountType);
  const gasStationEnabled = input.gasStationEnabled ?? context.gasStationEnabled ?? context.enableGasStation ?? true;
  const supportedBlockchain = GAS_SPONSORSHIP_SUPPORTED_BLOCKCHAINS.has(blockchain);
  const eligible = Boolean(gasStationEnabled && supportedBlockchain && walletAccountType === "SCA");
  let reason = "";

  if (!gasStationEnabled) {
    reason = "Circle Gas Station is disabled in server configuration.";
  } else if (!supportedBlockchain) {
    reason = `${blockchain || "unknown"} is not configured for Smart Request Gas Station sponsorship.`;
  } else if (walletAccountType !== "SCA") {
    reason = "Circle Gas Station sponsorship requires an eligible Smart Contract Account wallet.";
  }

  return {
    eligible,
    supportedBlockchain,
    blockchain,
    walletAccountType,
    reason
  };
}

function resolveTransactionBlockchain(context = {}, input = {}) {
  return String(input.blockchain || context.blockchain || DEFAULT_CHAIN).trim().toUpperCase();
}

function normalizeWalletAccountType(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");

  if (["SCA", "SMART_CONTRACT_ACCOUNT", "ACCOUNT_ABSTRACTION", "CONTRACT_ACCOUNT"].includes(normalized)) {
    return "SCA";
  }

  if (["EOA", "EXTERNALLY_OWNED_ACCOUNT"].includes(normalized)) {
    return "EOA";
  }

  return normalized;
}

function stringifyOptional(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function logGasSponsorshipResult(context, gasSponsorship, metadata = {}) {
  const logger = context?.logger || console;
  const event = gasSponsorship.confirmed
    ? "smart_request_gas_sponsorship_confirmed"
    : gasSponsorship.eligible
      ? "smart_request_gas_sponsorship_fallback"
      : "smart_request_gas_sponsorship_unsupported";
  const payload = {
    event,
    transactionId: metadata.transactionId || "",
    refId: metadata.refId || "",
    walletId: metadata.walletId || "",
    blockchain: gasSponsorship.blockchain || "",
    walletAccountType: gasSponsorship.walletAccountType || "",
    eligible: gasSponsorship.eligible,
    sponsored: gasSponsorship.sponsored,
    confirmed: gasSponsorship.confirmed,
    status: gasSponsorship.status || "",
    reason: gasSponsorship.reason || ""
  };

  if (typeof logger.info === "function") {
    logger.info("[circle-gas-sponsorship]", payload);
  }
}

function readTupleValue(value, key, index) {
  if (value?.[key] !== undefined) {
    return value[key];
  }

  return value?.[index];
}

function normalizeContractRecipients(recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > 10) {
    throw new Error("Recipients must contain between 1 and 10 entries.");
  }

  return recipients.map((recipient, index) => ({
    account: requireAddress(recipient.account || recipient.walletAddress, `Recipient ${index + 1} address`),
    allocationBps: normalizeAllocationBps(recipient.allocationBps, index)
  }));
}

function normalizeAllocationBps(value, index) {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new Error(`Recipient ${index + 1} allocation must be an integer between 0 and 10,000.`);
  }

  return value;
}

function resolveContractAddress(context, input = {}) {
  return input.contractAddress || context.contractAddress || context.veloxPayRequestsAddress || "";
}

function resolveFee(context, input = {}) {
  return input.fee || {
    type: "level",
    config: {
      feeLevel: input.feeLevel || context.feeLevel || DEFAULT_FEE_LEVEL
    }
  };
}

function resolveIdempotencyKey(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return crypto.randomUUID();
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return normalized;
  }

  const bytes = crypto.createHash("sha256").update(normalized).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(MODE_VALUES, mode)) {
    throw new Error("Payment mode must be standard, split, or protected.");
  }

  return mode;
}

function normalizeBaseUnits(value, label) {
  const normalized = String(value || "").trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${label} must be a positive integer string.`);
  }

  return normalized;
}

function normalizeNonNegativeBaseUnits(value, label) {
  const normalized = String(value ?? "").trim();

  if (!/^(0|[1-9]\d*)$/.test(normalized)) {
    throw new Error(`${label} must be a non-negative integer string.`);
  }

  return normalized;
}

function normalizeUint64(value, label) {
  const normalized = String(value || "").trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${label} must be a positive integer.`);
  }

  const asBigInt = BigInt(normalized);
  if (asBigInt > 2n ** 64n - 1n) {
    throw new Error(`${label} exceeds uint64.`);
  }

  return normalized;
}

function normalizeOnchainRequestId(value) {
  const normalized = String(value || "").trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error("Onchain request ID must be a positive integer string.");
  }

  return normalized;
}

function requireBytes32(value, label) {
  const normalized = String(value || "").trim();

  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a bytes32 hex string.`);
  }

  return normalized.toLowerCase();
}

function requireAddress(value, label) {
  const normalized = nonEmptyString(value, label);

  if (!ethers.isAddress(normalized)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }

  return ethers.getAddress(normalized);
}

function normalizeOptionalContractAddress(value) {
  const address = String(value || "").trim();

  if (!address || /^0x0{40}$/.test(address)) {
    return "";
  }

  return ethers.getAddress(address);
}

function nonEmptyString(value, label) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function requireCircleWalletsClient(context) {
  if (!context?.circleWalletsClient) {
    throw new SmartRequestContractError("CIRCLE_CLIENT_UNAVAILABLE", "Circle wallet integration is not enabled.", {
      retryable: false
    });
  }

  return context.circleWalletsClient;
}

function requireProvider(context) {
  if (!context?.provider) {
    throw new SmartRequestContractError("RPC_PROVIDER_UNAVAILABLE", "Arc RPC provider is not configured.", {
      retryable: true
    });
  }

  return context.provider;
}

function safeContractCall(fn) {
  return Promise.resolve()
    .then(fn)
    .then((data) => ({ ok: true, data }))
    .catch((error) => ({ ok: false, error: toSafeSmartRequestContractError(error) }));
}

function toSafeSmartRequestContractError(error) {
  return {
    code: error?.code || "SMART_REQUEST_CONTRACT_ERROR",
    message: safeErrorMessage(error),
    retryable: Boolean(error?.retryable),
    state: error?.state || "",
    transactionId: error?.transactionId || "",
    onchainStatus: error?.onchainStatus || ""
  };
}

function safeErrorMessage(error) {
  const message = error?.message || "Smart request contract operation failed.";

  if (/api[_ -]?key|entity[_ -]?secret|authorization|bearer/i.test(message)) {
    return "Smart request contract operation failed.";
  }

  return message;
}

function safeErrorToException(error) {
  return new SmartRequestContractError(error.code, error.message, error);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class SmartRequestContractError extends Error {
  constructor(code, message, metadata = {}) {
    super(message);
    this.name = "SmartRequestContractError";
    this.code = code;
    this.retryable = Boolean(metadata.retryable);
    this.state = metadata.state || "";
    this.transactionId = metadata.transactionId || "";
    this.onchainStatus = metadata.onchainStatus || "";
  }
}

module.exports = {
  ABI_SIGNATURES,
  TERMINAL_TRANSACTION_STATES,
  VELOXPAY_REQUESTS_ABI,
  approveAndReleaseProtectedPayment,
  approveSmartRequestToken,
  cancelOnchainSmartRequest,
  createOnchainSmartRequest,
  createSmartRequestContractService,
  estimateSmartRequestPayment,
  estimateTokenApproval,
  executeSmartRequestPayment,
  getSmartRequestFromContract,
  refundProtectedPayment,
  submitProtectedDeliverable,
  toSafeSmartRequestContractError,
  waitForCircleTransaction
};
