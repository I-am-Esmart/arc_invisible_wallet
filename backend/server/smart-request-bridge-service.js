const crypto = require("crypto");

const SOURCE_CHAIN = "Ethereum_Sepolia";
const DESTINATION_CHAIN = "Arc_Testnet";
const TOKEN = "USDC";
const SOURCE_EXPLORER_BASE_URL = "https://sepolia.etherscan.io/tx";
const ARC_EXPLORER_BASE_URL = "https://testnet.arcscan.app/tx";

function createSmartRequestBridgeService(context = {}) {
  return {
    estimateSmartRequestBridge: (input) => estimateSmartRequestBridge(context, input),
    executeSmartRequestBridge: (input) => executeSmartRequestBridge(context, input),
    normalizeBridgeEstimate,
    normalizeBridgeResult
  };
}

async function estimateSmartRequestBridge(context, input) {
  const kit = createKit(context);
  const params = buildBridgeParams(context, input);

  if (typeof kit.estimateBridge !== "function") {
    throw new Error("Circle App Kit bridge fee estimation is unavailable.");
  }

  const estimate = await kit.estimateBridge(params);
  return normalizeBridgeEstimate(estimate, input);
}

async function executeSmartRequestBridge(context, input) {
  const kit = createKit(context);
  const params = buildBridgeParams(context, input);
  const events = [];

  if (typeof kit.bridge !== "function") {
    throw new Error("Circle App Kit bridge execution is unavailable.");
  }

  if (typeof kit.on === "function") {
    kit.on("*", (payload) => {
      events.push(normalizeBridgeEvent(payload));
    });
  }

  try {
    const result = await kit.bridge(params);
    return normalizeBridgeResult(result, input, events);
  } catch (error) {
    return normalizeBridgeResult(
      {
        amount: params.amount,
        token: TOKEN,
        state: "error",
        provider: "circle-app-kit",
        source: { address: params.from.address, chain: SOURCE_CHAIN },
        destination: { address: params.to.address, chain: DESTINATION_CHAIN },
        steps: [],
        error
      },
      input,
      events
    );
  }
}

function buildBridgeParams(context, input) {
  const adapter = createAdapter(context);
  const sourceAddress = requireAddress(input.sourceAddress || input.fromAddress, "Source wallet address");
  const destinationAddress = requireAddress(input.destinationAddress || input.toAddress, "Destination Arc wallet address");
  const amount = nonEmptyString(input.amount, "Bridge amount");

  if (String(input.token || TOKEN).trim().toUpperCase() !== TOKEN) {
    throw new Error("VeloxPay cross-chain Smart Request payments support USDC only.");
  }

  return {
    from: {
      adapter,
      chain: SOURCE_CHAIN,
      address: sourceAddress
    },
    to: {
      adapter,
      chain: DESTINATION_CHAIN,
      address: destinationAddress,
      recipientAddress: destinationAddress
    },
    amount,
    token: TOKEN,
    invocationMeta: {
      traceId: input.traceId || crypto.randomUUID(),
      callers: [{ type: "app", name: "VeloxPay", version: "smart-requests" }]
    }
  };
}

function normalizeBridgeEstimate(estimate, input = {}) {
  const amount = String(estimate?.amount || input.amount || "");
  const fees = Array.isArray(estimate?.fees) ? estimate.fees.map(normalizeFee) : [];
  const expectedReceivedAmount = subtractHumanUsdc(amount, sumUsdcFees(fees));

  return {
    sourceNetwork: "Ethereum Sepolia",
    sourceChain: SOURCE_CHAIN,
    destinationNetwork: "Arc Testnet",
    destinationChain: DESTINATION_CHAIN,
    token: TOKEN,
    sourceAmount: amount,
    expectedReceivedAmount,
    gasFees: Array.isArray(estimate?.gasFees) ? estimate.gasFees.map(normalizeGasFee) : [],
    fees,
    rawState: "estimated"
  };
}

function normalizeBridgeResult(result, input = {}, events = []) {
  const steps = Array.isArray(result?.steps) ? result.steps.map(normalizeBridgeStep) : [];
  const amount = String(result?.amount || input.amount || "");
  const status = normalizeBridgeStatus(result?.state);
  const allEvents = events.filter(Boolean);

  return {
    id: input.id || crypto.randomUUID(),
    sourceNetwork: "Ethereum Sepolia",
    sourceChain: SOURCE_CHAIN,
    destinationNetwork: "Arc Testnet",
    destinationChain: DESTINATION_CHAIN,
    token: TOKEN,
    sourceAmount: amount,
    expectedReceivedAmount: amount,
    status,
    provider: String(result?.provider || "circle-app-kit"),
    steps,
    events: allEvents,
    sourceExplorerBaseUrl: SOURCE_EXPLORER_BASE_URL,
    destinationExplorerBaseUrl: ARC_EXPLORER_BASE_URL,
    error: status === "error" ? normalizeError(result?.error || steps.find((step) => step.status === "error")?.error) : null,
    rawState: String(result?.state || "")
  };
}

function normalizeBridgeStep(step) {
  const name = String(step?.name || "").trim() || "Bridge step";
  const txHash = String(step?.txHash || step?.hash || "").trim();
  const chain = inferStepChain(name, step);

  return {
    name,
    status: normalizeBridgeStatus(step?.state || step?.status),
    chain,
    txHash,
    explorerUrl: step?.explorerUrl || explorerUrlForChain(chain, txHash),
    forwarded: Boolean(step?.forwarded),
    batched: Boolean(step?.batched),
    batchId: String(step?.batchId || ""),
    error: step?.errorMessage || step?.error ? normalizeError(step.errorMessage || step.error) : null
  };
}

function normalizeBridgeEvent(payload) {
  const method = String(payload?.method || payload?.type || payload?.name || "").trim();
  const values = payload?.values || payload?.data || payload || {};
  const txHash = String(values?.txHash || values?.hash || "").trim();
  const chain = inferStepChain(method, values);

  return {
    method,
    status: normalizeBridgeStatus(values?.state || values?.status || "pending"),
    chain,
    txHash,
    explorerUrl: explorerUrlForChain(chain, txHash),
    at: new Date().toISOString()
  };
}

function normalizeFee(fee) {
  return {
    type: String(fee?.type || ""),
    token: String(fee?.token || TOKEN),
    amount: fee?.amount === null || fee?.amount === undefined ? "" : String(fee.amount),
    error: fee?.error ? normalizeError(fee.error) : null
  };
}

function normalizeGasFee(gasFee) {
  return {
    name: String(gasFee?.name || ""),
    token: String(gasFee?.token || ""),
    blockchain: String(gasFee?.blockchain?.name || gasFee?.blockchain || ""),
    fee: gasFee?.fees?.fee ? String(gasFee.fees.fee) : "",
    error: gasFee?.error ? normalizeError(gasFee.error) : null
  };
}

function normalizeBridgeStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (["success", "complete", "completed"].includes(status)) {
    return "success";
  }

  if (["error", "failed", "failure"].includes(status)) {
    return "error";
  }

  return status === "noop" ? "success" : "pending";
}

function inferStepChain(name, step = {}) {
  const label = String(name || step.chain || "").toLowerCase();

  if (label.includes("mint") || label.includes("arc")) {
    return DESTINATION_CHAIN;
  }

  return SOURCE_CHAIN;
}

function explorerUrlForChain(chain, txHash) {
  if (!txHash) {
    return "";
  }

  return `${chain === DESTINATION_CHAIN ? ARC_EXPLORER_BASE_URL : SOURCE_EXPLORER_BASE_URL}/${txHash}`;
}

function sumUsdcFees(fees) {
  return fees.reduce((total, fee) => total + humanUsdcToBaseUnits(fee.token === TOKEN ? fee.amount : "0"), 0n);
}

function subtractHumanUsdc(amount, feeBaseUnits) {
  const amountBaseUnits = humanUsdcToBaseUnits(amount);
  const received = amountBaseUnits > feeBaseUnits ? amountBaseUnits - feeBaseUnits : 0n;
  return formatUsdcBaseUnits(received);
}

function humanUsdcToBaseUnits(value) {
  const amount = String(value || "0").trim();

  if (!/^(0|[1-9]\d*)(\.\d{0,6})?$/.test(amount)) {
    return 0n;
  }

  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0") || "0");
}

function formatUsdcBaseUnits(value) {
  const whole = value / 1_000_000n;
  const fraction = value % 1_000_000n;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

function createKit(context) {
  if (typeof context.createAppKit === "function") {
    return context.createAppKit();
  }

  const { createAppKit } = require("./arc-app-kit");
  return createAppKit();
}

function createAdapter(context) {
  if (context.adapter) {
    return context.adapter;
  }

  if (typeof context.createCircleAppKitAdapter === "function") {
    return context.createCircleAppKitAdapter(context);
  }

  const { createCircleAppKitAdapter } = require("./arc-app-kit");
  return createCircleAppKitAdapter(context);
}

function normalizeError(error) {
  const message = typeof error === "string" ? error : error?.message || "Bridge operation failed.";

  return {
    message: /api[_ -]?key|entity[_ -]?secret|authorization|bearer/i.test(message)
      ? "Bridge operation failed."
      : message,
    code: String(error?.code || error?.name || "")
  };
}

function requireAddress(value, label) {
  const address = nonEmptyString(value, label);

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }

  return address;
}

function nonEmptyString(value, label) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

module.exports = {
  DESTINATION_CHAIN,
  SOURCE_CHAIN,
  TOKEN,
  createSmartRequestBridgeService,
  normalizeBridgeEstimate,
  normalizeBridgeResult
};
