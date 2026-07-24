const crypto = require("crypto");
const { ethers } = require("ethers");

const BASIS_POINTS = 10_000;
const MAX_RECIPIENTS = 10;
const DEFAULT_CHAIN = "ARC-TESTNET";
const DEFAULT_CONTRACT_ADDRESS = "";
const PAYMENT_MODES = new Set(["standard", "split", "protected"]);
const OFFCHAIN_STATUSES = new Set([
  "draft",
  "open",
  "awaiting_funding",
  "funded",
  "submitted",
  "settled",
  "refunded",
  "cancelled",
  "failed",
  "recovery_required"
]);
const ONCHAIN_STATUSES = new Set(["not_created", "open", "funded", "submitted", "settled", "refunded", "cancelled", "unknown"]);
const TOKEN_DECIMALS = {
  USDC: 6,
  EURC: 6
};

function normalizeSmartRequest(input, options = {}) {
  assertRecord(input, "Smart request");

  const now = options.now || new Date().toISOString();
  const id = nonEmptyString(input.id || input.internalId || crypto.randomUUID(), "Smart request ID");
  const paymentLinkId = optionalString(input.paymentLinkId || input.existingPaymentLinkId);
  const mode = normalizePaymentMode(input.mode || input.paymentMode);
  const currency = normalizeCurrency(input.currency);
  const decimals = Number.isInteger(options.decimals) ? options.decimals : TOKEN_DECIMALS[currency];

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Unsupported currency decimals for ${currency}`);
  }

  const amount = normalizeHumanAmount(input.amount || input.humanReadableAmount, decimals);
  const amountBaseUnits = input.amountBaseUnits
    ? normalizeBaseUnits(input.amountBaseUnits, "Amount base units")
    : parseTokenAmountToBaseUnits(amount, decimals);

  if (formatBaseUnits(amountBaseUnits, decimals) !== amount) {
    throw new Error("Human-readable amount and base-unit amount do not match");
  }

  const creatorWalletAddress = requireAddress(input.creatorWalletAddress, "Creator wallet address");
  const dueDate = normalizeIsoDate(input.dueDate, "Due date");
  const refundEligibilityDate = input.refundEligibilityDate
    ? normalizeIsoDate(input.refundEligibilityDate, "Refund eligibility date")
    : mode === "protected"
      ? dueDate
      : "";
  const tokenAddress = requireAddress(input.tokenAddress, "Token address");
  const contractAddress = input.contractAddress
    ? requireAddress(input.contractAddress, "Contract address")
    : DEFAULT_CONTRACT_ADDRESS;
  const recipients = normalizeRecipients(input.recipients, { amountBaseUnits, decimals, mode });
  const metadata = buildSmartRequestMetadata({
    id,
    paymentLinkId,
    externalPaymentId: input.externalPaymentId || buildExternalPaymentId(id),
    contractAddress,
    chain: nonEmptyString(input.chain || DEFAULT_CHAIN, "Chain"),
    mode,
    currency,
    tokenAddress,
    amount,
    amountBaseUnits,
    creatorUserId: nonEmptyString(input.creatorUserId, "Creator user ID"),
    creatorWalletId: nonEmptyString(input.creatorWalletId, "Creator wallet ID"),
    creatorWalletAddress,
    expectedPayerEmail: normalizeEmail(input.expectedPayerEmail),
    recipients,
    description: optionalString(input.description),
    dueDate,
    refundEligibilityDate
  });
  const metadataHash = input.metadataHash ? requireBytes32(input.metadataHash, "Metadata hash") : hashCanonicalJson(metadata);
  const createdAt = normalizeIsoDate(input.createdAt || now, "Created timestamp");
  const updatedAt = normalizeIsoDate(input.updatedAt || now, "Updated timestamp");

  return {
    id,
    paymentLinkId,
    onchainRequestId: normalizeOnchainRequestId(input.onchainRequestId),
    externalPaymentId: requireBytes32(input.externalPaymentId || metadata.externalPaymentId, "External payment ID"),
    contractAddress,
    chain: metadata.chain,
    mode,
    currency,
    tokenAddress,
    amount,
    amountBaseUnits,
    creatorUserId: metadata.creatorUserId,
    creatorWalletId: metadata.creatorWalletId,
    creatorWalletAddress,
    expectedPayerEmail: metadata.expectedPayerEmail,
    actualPayerEmail: normalizeEmail(input.actualPayerEmail),
    actualPayerWalletId: optionalString(input.actualPayerWalletId),
    actualPayerWalletAddress: input.actualPayerWalletAddress
      ? requireAddress(input.actualPayerWalletAddress, "Actual payer wallet address")
      : "",
    recipients,
    description: metadata.description,
    dueDate,
    refundEligibilityDate,
    metadataHash,
    deliverableUrl: optionalString(input.deliverableUrl),
    deliverableNote: optionalString(input.deliverableNote),
    deliverableSubmittedAt: input.deliverableSubmittedAt ? normalizeIsoDate(input.deliverableSubmittedAt, "Deliverable submitted timestamp") : "",
    deliverableRecordHash: input.deliverableRecordHash ? requireBytes32(input.deliverableRecordHash, "Deliverable record hash") : "",
    deliverableHash: input.deliverableHash ? requireBytes32(input.deliverableHash, "Deliverable hash") : "",
    deliverableTransactionId: optionalString(input.deliverableTransactionId),
    deliverableTransactionHash: optionalTxHash(input.deliverableTransactionHash, "Deliverable transaction hash"),
    fundingTransactionId: optionalString(input.fundingTransactionId),
    fundingTransactionHash: optionalTxHash(input.fundingTransactionHash, "Funding transaction hash"),
    releaseTransactionId: optionalString(input.releaseTransactionId),
    releaseTransactionHash: optionalTxHash(input.releaseTransactionHash, "Release transaction hash"),
    refundTransactionId: optionalString(input.refundTransactionId),
    refundTransactionHash: optionalTxHash(input.refundTransactionHash, "Refund transaction hash"),
    bridge: normalizeBridgeRecord(input.bridge),
    offchainStatus: normalizeEnum(input.offchainStatus || "open", OFFCHAIN_STATUSES, "Offchain status"),
    onchainStatus: normalizeEnum(input.onchainStatus || "not_created", ONCHAIN_STATUSES, "Onchain status"),
    createdAt,
    updatedAt,
    error: normalizeErrorInfo(input.error),
    recovery: normalizeRecoveryInfo(input.recovery)
  };
}

function buildSmartRequestFromPaymentLink(paymentLink, overrides = {}) {
  assertRecord(paymentLink, "Payment link");

  return normalizeSmartRequest({
    paymentLinkId: paymentLink.id || paymentLink.linkCode,
    currency: paymentLink.currency,
    amount: paymentLink.amount,
    creatorUserId: paymentLink.ownerEmail,
    creatorWalletId: overrides.creatorWalletId || paymentLink.ownerEmail,
    creatorWalletAddress: paymentLink.recipientAddress,
    expectedPayerEmail: paymentLink.customerEmail || "",
    recipients: [
      {
        name: paymentLink.ownerName || paymentLink.username || "",
        role: "owner",
        email: paymentLink.ownerEmail || "",
        walletAddress: paymentLink.recipientAddress,
        allocationBps: BASIS_POINTS
      }
    ],
    description: paymentLink.description || "",
    dueDate: overrides.dueDate,
    ...overrides
  });
}

function buildSmartRequestMetadata(smartRequest) {
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
      amountBaseUnits: recipient.amountBaseUnits
    })),
    description: smartRequest.description || "",
    dueDate: smartRequest.dueDate,
    refundEligibilityDate: smartRequest.refundEligibilityDate || ""
  };
}

function serializeSmartRequest(smartRequest) {
  return normalizeSmartRequest(smartRequest);
}

function deserializeSmartRequest(serialized) {
  if (typeof serialized === "string") {
    return normalizeSmartRequest(JSON.parse(serialized));
  }

  return normalizeSmartRequest(serialized);
}

function createSmartRequestRepository({ store, writeStore, getPersistentJson, setPersistentJson } = {}) {
  const localStore = store || { smartRequests: [] };

  if (!Array.isArray(localStore.smartRequests)) {
    localStore.smartRequests = [];
  }

  async function save(smartRequest) {
    const normalized = normalizeSmartRequest(smartRequest, { now: smartRequest.updatedAt || new Date().toISOString() });
    const index = localStore.smartRequests.findIndex((entry) => entry.id === normalized.id);

    if (index >= 0) {
      localStore.smartRequests[index] = {
        ...localStore.smartRequests[index],
        ...normalized
      };
    } else {
      localStore.smartRequests.push(normalized);
    }

    if (typeof setPersistentJson === "function") {
      await setPersistentJson(smartRequestKey(normalized.id), normalized);
      await setPersistentJson(smartRequestExternalKey(normalized.externalPaymentId), normalized.id);

      if (normalized.onchainRequestId && normalized.contractAddress) {
        await setPersistentJson(
          smartRequestOnchainKey(normalized.chain, normalized.contractAddress, normalized.onchainRequestId),
          normalized.id
        );
      }

      if (normalized.paymentLinkId) {
        await setPersistentJson(smartRequestPaymentLinkKey(normalized.paymentLinkId), normalized.id);
      }

      await savePersistentSmartRequestIndex({
        key: smartRequestsCreatorKey(normalized.creatorUserId),
        smartRequest: normalized,
        getPersistentJson,
        setPersistentJson
      });

      const payerEmail = normalized.actualPayerEmail || normalized.expectedPayerEmail;
      if (payerEmail) {
        await savePersistentSmartRequestIndex({
          key: smartRequestsPayerKey(payerEmail),
          smartRequest: normalized,
          getPersistentJson,
          setPersistentJson
        });
      }
    }

    if (typeof writeStore === "function") {
      writeStore(localStore);
    }

    return normalized;
  }

  async function getById(id) {
    const normalizedId = nonEmptyString(id, "Smart request ID");
    const persistent = await getPersistentSmartRequestById(normalizedId);

    if (persistent) {
      return persistent;
    }

    const found = localStore.smartRequests.find((entry) => entry.id === normalizedId) || null;
    return found ? deserializeSmartRequest(found) : null;
  }

  async function getByExternalPaymentId(externalPaymentId) {
    const normalizedExternalPaymentId = requireBytes32(externalPaymentId, "External payment ID");

    if (typeof getPersistentJson === "function") {
      const id = await getPersistentJson(smartRequestExternalKey(normalizedExternalPaymentId));
      if (id) {
        return getById(String(id));
      }
    }

    const found = localStore.smartRequests.find((entry) => entry.externalPaymentId === normalizedExternalPaymentId) || null;
    return found ? deserializeSmartRequest(found) : null;
  }

  async function getByPaymentLinkId(paymentLinkId) {
    const normalizedPaymentLinkId = nonEmptyString(paymentLinkId, "Payment link ID");

    if (typeof getPersistentJson === "function") {
      const id = await getPersistentJson(smartRequestPaymentLinkKey(normalizedPaymentLinkId));
      if (id) {
        return getById(String(id));
      }
    }

    const found = localStore.smartRequests.find((entry) => entry.paymentLinkId === normalizedPaymentLinkId) || null;
    return found ? deserializeSmartRequest(found) : null;
  }

  async function getByOnchainRequest({ chain, contractAddress, onchainRequestId }) {
    const normalizedChain = nonEmptyString(chain || DEFAULT_CHAIN, "Chain");
    const normalizedContractAddress = requireAddress(contractAddress, "Contract address");
    const normalizedOnchainRequestId = normalizeOnchainRequestId(onchainRequestId);

    if (!normalizedOnchainRequestId) {
      throw new Error("Onchain request ID is required");
    }

    if (typeof getPersistentJson === "function") {
      const id = await getPersistentJson(
        smartRequestOnchainKey(normalizedChain, normalizedContractAddress, normalizedOnchainRequestId)
      );
      if (id) {
        return getById(String(id));
      }
    }

    const found =
      localStore.smartRequests.find((entry) => {
        return (
          entry.chain === normalizedChain &&
          entry.contractAddress === normalizedContractAddress &&
          entry.onchainRequestId === normalizedOnchainRequestId
        );
      }) || null;
    return found ? deserializeSmartRequest(found) : null;
  }

  async function listByCreatorUserId(creatorUserId) {
    const normalizedCreatorUserId = nonEmptyString(creatorUserId, "Creator user ID");

    if (typeof getPersistentJson === "function") {
      const stored = await getPersistentJson(smartRequestsCreatorKey(normalizedCreatorUserId));
      if (Array.isArray(stored)) {
        return stored.map(deserializeSmartRequest);
      }
    }

    return localStore.smartRequests
      .filter((entry) => entry.creatorUserId === normalizedCreatorUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(deserializeSmartRequest);
  }

  async function listByPayerEmail(payerEmail) {
    const normalizedPayerEmail = normalizeEmail(payerEmail);

    if (!normalizedPayerEmail) {
      throw new Error("Payer email is required");
    }

    if (typeof getPersistentJson === "function") {
      const stored = await getPersistentJson(smartRequestsPayerKey(normalizedPayerEmail));
      if (Array.isArray(stored)) {
        return stored.map(deserializeSmartRequest);
      }
    }

    return localStore.smartRequests
      .filter((entry) => entry.actualPayerEmail === normalizedPayerEmail || entry.expectedPayerEmail === normalizedPayerEmail)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(deserializeSmartRequest);
  }

  async function getPersistentSmartRequestById(id) {
    if (typeof getPersistentJson !== "function") {
      return null;
    }

    const stored = await getPersistentJson(smartRequestKey(id));
    return stored ? deserializeSmartRequest(stored) : null;
  }

  return {
    save,
    getById,
    getByExternalPaymentId,
    getByOnchainRequest,
    getByPaymentLinkId,
    listByCreatorUserId,
    listByPayerEmail
  };
}

async function savePersistentSmartRequestIndex({ key, smartRequest, getPersistentJson, setPersistentJson }) {
  if (typeof getPersistentJson !== "function" || typeof setPersistentJson !== "function") {
    return;
  }

  const existing = await getPersistentJson(key);
  const requests = Array.isArray(existing) ? existing : [];
  const deduped = [smartRequest, ...requests.filter((entry) => entry?.id !== smartRequest.id)].slice(0, 100);
  await setPersistentJson(key, deduped);
}

function smartRequestKey(id) {
  return `veloxpay:smart-request:${String(id || "").trim()}`;
}

function smartRequestExternalKey(externalPaymentId) {
  return `veloxpay:smart-request:external:${String(externalPaymentId || "").trim().toLowerCase()}`;
}

function smartRequestPaymentLinkKey(paymentLinkId) {
  return `veloxpay:smart-request:payment-link:${String(paymentLinkId || "").trim().toLowerCase()}`;
}

function smartRequestOnchainKey(chain, contractAddress, onchainRequestId) {
  return `veloxpay:smart-request:onchain:${String(chain || "").trim().toUpperCase()}:${String(contractAddress || "")
    .trim()
    .toLowerCase()}:${String(onchainRequestId || "").trim()}`;
}

function smartRequestsCreatorKey(creatorUserId) {
  return `veloxpay:smart-requests:creator:${String(creatorUserId || "").trim().toLowerCase()}`;
}

function smartRequestsPayerKey(payerEmail) {
  return `veloxpay:smart-requests:payer:${normalizeEmail(payerEmail)}`;
}

function normalizeRecipients(recipients, { amountBaseUnits, decimals, mode }) {
  if (!Array.isArray(recipients)) {
    throw new Error("Recipients must be an array");
  }

  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
    throw new Error(`Recipients must contain between 1 and ${MAX_RECIPIENTS} entries`);
  }

  if (mode === "standard" && recipients.length !== 1) {
    throw new Error("Standard smart requests require exactly one recipient");
  }

  let totalBps = 0;
  const normalized = recipients.map((recipient, index) => {
    assertRecord(recipient, `Recipient ${index + 1}`);

    const allocationBps = normalizeAllocationBps(recipient.allocationBps, index);
    totalBps += allocationBps;

    return {
      name: optionalString(recipient.name),
      role: optionalString(recipient.role),
      email: normalizeEmail(recipient.email),
      walletAddress: requireAddress(recipient.walletAddress, `Recipient ${index + 1} wallet address`),
      allocationBps,
      amount: "0",
      amountBaseUnits: "0"
    };
  });

  if (totalBps !== BASIS_POINTS) {
    throw new Error("Recipient allocations must total exactly 10,000 basis points");
  }

  return calculateRecipientAmounts(normalized, amountBaseUnits, decimals);
}

function calculateRecipientAmounts(recipients, amountBaseUnits, decimals) {
  const amount = BigInt(normalizeBaseUnits(amountBaseUnits, "Amount base units"));
  let remaining = amount;

  return recipients.map((recipient, index) => {
    const isLast = index === recipients.length - 1;
    const recipientAmount = isLast ? remaining : (amount * BigInt(recipient.allocationBps)) / BigInt(BASIS_POINTS);
    remaining -= recipientAmount;

    return {
      ...recipient,
      amountBaseUnits: recipientAmount.toString(),
      amount: formatBaseUnits(recipientAmount.toString(), decimals)
    };
  });
}

function parseTokenAmountToBaseUnits(amount, decimals) {
  const normalized = normalizeHumanAmount(amount, decimals);
  const [whole, fraction = ""] = normalized.split(".");
  const wholeUnits = BigInt(whole) * 10n ** BigInt(decimals);
  const fractionUnits = BigInt(fraction.padEnd(decimals, "0") || "0");
  const baseUnits = wholeUnits + fractionUnits;

  if (baseUnits <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  return baseUnits.toString();
}

function formatBaseUnits(baseUnits, decimals) {
  const units = BigInt(normalizeBaseUnits(baseUnits, "Amount base units"));
  const scale = 10n ** BigInt(decimals);
  const whole = units / scale;
  const fraction = units % scale;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function hashCanonicalJson(value) {
  return `0x${crypto.createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalize(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function buildExternalPaymentId(id) {
  return `0x${crypto.createHash("sha256").update(String(id), "utf8").digest("hex")}`;
}

function buildDeliverableRecord({ smartRequest, deliverableUrl, note, submittedBy, submittedAt }) {
  assertRecord(smartRequest, "Smart request");

  return canonicalize({
    type: "veloxpay.protected-deliverable.v1",
    smartRequestId: nonEmptyString(smartRequest.id, "Smart request ID"),
    paymentLinkId: optionalString(smartRequest.paymentLinkId),
    onchainRequestId: normalizeOnchainRequestId(smartRequest.onchainRequestId),
    externalPaymentId: requireBytes32(smartRequest.externalPaymentId, "External payment ID"),
    contractAddress: requireAddress(smartRequest.contractAddress, "Contract address"),
    chain: nonEmptyString(smartRequest.chain || DEFAULT_CHAIN, "Chain"),
    deliverableUrl: nonEmptyString(deliverableUrl, "Deliverable URL"),
    note: optionalString(note),
    submittedBy: normalizeEmail(submittedBy),
    submittedAt: normalizeIsoDate(submittedAt || new Date().toISOString(), "Deliverable submitted timestamp")
  });
}

function hashDeliverableRecord(record) {
  return hashCanonicalJson(record);
}

function canSubmitProtectedDeliverable(smartRequest, actorEmail) {
  const actor = normalizeEmail(actorEmail);

  return Boolean(
    smartRequest?.mode === "protected" &&
    actor &&
    normalizeEmail(smartRequest.creatorUserId) === actor &&
    smartRequest.offchainStatus === "funded" &&
    smartRequest.onchainStatus === "funded" &&
    !smartRequest.deliverableHash
  );
}

function canApproveProtectedRelease(smartRequest, actorEmail) {
  const actor = normalizeEmail(actorEmail);

  return Boolean(
    smartRequest?.mode === "protected" &&
    actor &&
    (normalizeEmail(smartRequest.expectedPayerEmail) === actor || normalizeEmail(smartRequest.actualPayerEmail) === actor) &&
    smartRequest.offchainStatus === "submitted" &&
    smartRequest.onchainStatus === "submitted" &&
    smartRequest.deliverableHash
  );
}

function canRefundProtectedByCreator(smartRequest, actorEmail) {
  const actor = normalizeEmail(actorEmail);

  return Boolean(
    smartRequest?.mode === "protected" &&
    actor &&
    normalizeEmail(smartRequest.creatorUserId) === actor &&
    smartRequest.offchainStatus === "funded" &&
    smartRequest.onchainStatus === "funded" &&
    !smartRequest.deliverableHash
  );
}

function canClaimExpiredProtectedRefund(smartRequest, actorEmail, now = new Date()) {
  const actor = normalizeEmail(actorEmail);
  const dueAt = smartRequest?.dueDate ? new Date(smartRequest.dueDate).getTime() : Number.NaN;

  return Boolean(
    smartRequest?.mode === "protected" &&
    actor &&
    (normalizeEmail(smartRequest.expectedPayerEmail) === actor || normalizeEmail(smartRequest.actualPayerEmail) === actor) &&
    smartRequest.offchainStatus === "funded" &&
    smartRequest.onchainStatus === "funded" &&
    !smartRequest.deliverableHash &&
    !Number.isNaN(dueAt) &&
    dueAt <= new Date(now).getTime()
  );
}

function canPayerAccessSmartRequest(smartRequest, payerEmail) {
  const normalizedPayerEmail = normalizeEmail(payerEmail);
  const expectedPayerEmail = normalizeEmail(smartRequest?.expectedPayerEmail);
  const actualPayerEmail = normalizeEmail(smartRequest?.actualPayerEmail);

  return Boolean(
    normalizedPayerEmail &&
    (!expectedPayerEmail || expectedPayerEmail === normalizedPayerEmail) &&
    (!actualPayerEmail || actualPayerEmail === normalizedPayerEmail)
  );
}

function buildSmartRequestTimeline(smartRequest) {
  const timeline = [
    {
      id: `${smartRequest.id}:created`,
      status: "sent",
      label: "Smart Request created",
      details: `${smartRequest.amount} ${smartRequest.currency}`,
      at: smartRequest.createdAt
    }
  ];

  if (smartRequest.fundingTransactionId || smartRequest.fundingTransactionHash || ["funded", "submitted", "settled"].includes(smartRequest.offchainStatus)) {
    timeline.push({
      id: `${smartRequest.id}:funded`,
      status: "paid",
      label: "Protected payment funded",
      details: smartRequest.fundingTransactionHash || smartRequest.fundingTransactionId || "",
      at: smartRequest.updatedAt || smartRequest.createdAt
    });
  }

  if (smartRequest.deliverableHash) {
    timeline.push({
      id: `${smartRequest.id}:submitted`,
      status: "paid",
      label: "Deliverable submitted",
      details: smartRequest.deliverableTransactionHash || smartRequest.deliverableUrl || smartRequest.deliverableHash,
      at: smartRequest.deliverableSubmittedAt || smartRequest.updatedAt
    });
  }

  if (smartRequest.releaseTransactionHash || smartRequest.offchainStatus === "settled") {
    timeline.push({
      id: `${smartRequest.id}:settled`,
      status: "paid",
      label: "Payment released",
      details: smartRequest.releaseTransactionHash || smartRequest.releaseTransactionId || "",
      at: smartRequest.updatedAt
    });
  }

  if (smartRequest.refundTransactionHash || smartRequest.offchainStatus === "refunded") {
    timeline.push({
      id: `${smartRequest.id}:refunded`,
      status: "failed",
      label: "Payment refunded",
      details: smartRequest.refundTransactionHash || smartRequest.refundTransactionId || "",
      at: smartRequest.updatedAt
    });
  }

  return timeline.filter((event) => event.at);
}

function normalizePaymentMode(value) {
  const mode = String(value || "").trim().toLowerCase();

  if (!PAYMENT_MODES.has(mode)) {
    throw new Error("Payment mode must be standard, split, or protected");
  }

  return mode;
}

function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();

  if (!TOKEN_DECIMALS[currency]) {
    throw new Error(`Unsupported smart request currency: ${currency || "(empty)"}`);
  }

  return currency;
}

function normalizeHumanAmount(value, decimals) {
  const amount = String(value || "").trim();

  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) {
    throw new Error("Amount must be a positive decimal string");
  }

  const [whole, fraction = ""] = amount.split(".");

  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places`);
  }

  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalized = normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;

  if (parseTokenAmountToBaseUnitsUnchecked(normalized, decimals) <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  return normalized;
}

function parseTokenAmountToBaseUnitsUnchecked(amount, decimals) {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

function normalizeBaseUnits(value, label) {
  const normalized = String(value || "").trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${label} must be a positive integer string`);
  }

  return normalized;
}

function normalizeAllocationBps(value, index) {
  if (!Number.isInteger(value) || value < 0 || value > BASIS_POINTS) {
    throw new Error(`Recipient ${index + 1} allocation must be an integer between 0 and 10,000`);
  }

  return value;
}

function normalizeOnchainRequestId(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const normalized = String(value).trim();

  if (!/^(0|[1-9]\d*)$/.test(normalized)) {
    throw new Error("Onchain request ID must be an integer string");
  }

  return normalized;
}

function normalizeEnum(value, allowed, label) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!allowed.has(normalized)) {
    throw new Error(`${label} is not supported`);
  }

  return normalized;
}

function normalizeBridgeRecord(value) {
  if (!value) {
    return null;
  }

  assertRecord(value, "Smart request bridge");

  const token = String(value.token || "USDC").trim().toUpperCase();
  const sourceChain = optionalString(value.sourceChain || "Ethereum_Sepolia");
  const destinationChain = optionalString(value.destinationChain || "Arc_Testnet");

  if (token !== "USDC") {
    throw new Error("Smart Request bridge token must be USDC");
  }

  if (sourceChain !== "Ethereum_Sepolia" || destinationChain !== "Arc_Testnet") {
    throw new Error("Smart Request bridge route must be Ethereum Sepolia to Arc Testnet");
  }

  return {
    id: optionalString(value.id),
    sourceNetwork: optionalString(value.sourceNetwork || "Ethereum Sepolia"),
    sourceChain,
    destinationNetwork: optionalString(value.destinationNetwork || "Arc Testnet"),
    destinationChain,
    token,
    sourceAmount: optionalString(value.sourceAmount),
    expectedReceivedAmount: optionalString(value.expectedReceivedAmount),
    status: normalizeBridgeStatus(value.status),
    provider: optionalString(value.provider),
    quote: value.quote && typeof value.quote === "object" && !Array.isArray(value.quote) ? value.quote : null,
    steps: Array.isArray(value.steps) ? value.steps.map(normalizeBridgeStep) : [],
    events: Array.isArray(value.events) ? value.events.map(normalizeBridgeEvent) : [],
    sourceExplorerBaseUrl: optionalString(value.sourceExplorerBaseUrl),
    destinationExplorerBaseUrl: optionalString(value.destinationExplorerBaseUrl),
    error: normalizeErrorInfo(value.error),
    createdAt: value.createdAt ? normalizeIsoDate(value.createdAt, "Bridge created timestamp") : "",
    updatedAt: value.updatedAt ? normalizeIsoDate(value.updatedAt, "Bridge updated timestamp") : ""
  };
}

function normalizeBridgeStatus(value) {
  const status = String(value || "pending").trim().toLowerCase();

  if (!["pending", "success", "error", "recovery_required"].includes(status)) {
    throw new Error("Bridge status is not supported");
  }

  return status;
}

function normalizeBridgeStep(step) {
  assertRecord(step, "Bridge step");

  return {
    name: optionalString(step.name),
    status: normalizeBridgeStepStatus(step.status || step.state),
    chain: optionalString(step.chain),
    txHash: optionalTxHash(step.txHash, "Bridge transaction hash"),
    explorerUrl: optionalString(step.explorerUrl),
    forwarded: Boolean(step.forwarded),
    batched: Boolean(step.batched),
    batchId: optionalString(step.batchId),
    error: normalizeErrorInfo(step.error)
  };
}

function normalizeBridgeEvent(event) {
  assertRecord(event, "Bridge event");

  return {
    method: optionalString(event.method),
    status: normalizeBridgeStepStatus(event.status || event.state),
    chain: optionalString(event.chain),
    txHash: optionalTxHash(event.txHash, "Bridge event transaction hash"),
    explorerUrl: optionalString(event.explorerUrl),
    at: event.at ? normalizeIsoDate(event.at, "Bridge event timestamp") : ""
  };
}

function normalizeBridgeStepStatus(value) {
  const status = String(value || "pending").trim().toLowerCase();

  if (!["pending", "success", "error"].includes(status)) {
    return "pending";
  }

  return status;
}

function normalizeEmail(value) {
  const email = optionalString(value).toLowerCase();

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email must be valid when provided");
  }

  return email;
}

function requireAddress(value, label) {
  const address = nonEmptyString(value, label);

  if (!ethers.isAddress(address)) {
    throw new Error(`${label} must be a valid EVM address`);
  }

  return ethers.getAddress(address);
}

function requireBytes32(value, label) {
  const normalized = String(value || "").trim();

  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a bytes32 hex string`);
  }

  return normalized.toLowerCase();
}

function optionalTxHash(value, label) {
  const normalized = optionalString(value);

  if (normalized && !/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a transaction hash`);
  }

  return normalized.toLowerCase();
}

function normalizeIsoDate(value, label) {
  const normalized = nonEmptyString(value, label);
  const timestamp = new Date(normalized).getTime();

  if (Number.isNaN(timestamp)) {
    throw new Error(`${label} must be an ISO date string`);
  }

  return new Date(timestamp).toISOString();
}

function normalizeErrorInfo(value) {
  if (!value) {
    return {
      code: "",
      message: "",
      at: ""
    };
  }

  assertRecord(value, "Error information");

  return {
    code: optionalString(value.code),
    message: optionalString(value.message),
    at: value.at ? normalizeIsoDate(value.at, "Error timestamp") : ""
  };
}

function normalizeRecoveryInfo(value) {
  if (!value) {
    return {
      retryable: false,
      attempts: 0,
      nextAction: "",
      lastAttemptAt: ""
    };
  }

  assertRecord(value, "Recovery information");

  if (!Number.isInteger(value.attempts || 0) || (value.attempts || 0) < 0) {
    throw new Error("Recovery attempts must be a non-negative integer");
  }

  return {
    retryable: Boolean(value.retryable),
    attempts: value.attempts || 0,
    nextAction: optionalString(value.nextAction),
    lastAttemptAt: value.lastAttemptAt ? normalizeIsoDate(value.lastAttemptAt, "Recovery timestamp") : ""
  };
}

function nonEmptyString(value, label) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  return normalized;
}

function optionalString(value) {
  return String(value || "").trim();
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

module.exports = {
  BASIS_POINTS,
  DEFAULT_CHAIN,
  MAX_RECIPIENTS,
  buildExternalPaymentId,
  buildDeliverableRecord,
  buildSmartRequestTimeline,
  buildSmartRequestFromPaymentLink,
  buildSmartRequestMetadata,
  canApproveProtectedRelease,
  canClaimExpiredProtectedRefund,
  canPayerAccessSmartRequest,
  canRefundProtectedByCreator,
  canSubmitProtectedDeliverable,
  calculateRecipientAmounts,
  canonicalJson,
  createSmartRequestRepository,
  deserializeSmartRequest,
  formatBaseUnits,
  hashDeliverableRecord,
  hashCanonicalJson,
  normalizeSmartRequest,
  parseTokenAmountToBaseUnits,
  serializeSmartRequest,
  smartRequestExternalKey,
  smartRequestKey,
  smartRequestOnchainKey,
  smartRequestPaymentLinkKey,
  smartRequestsCreatorKey,
  smartRequestsPayerKey
};
