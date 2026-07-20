const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const nodemailer = require("nodemailer");
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");
const {
  executeBridgeWithCircleWallets,
  executeSwapWithCircleWallets,
  getUnifiedBalanceWithCircleWallets
} = require("./arc-app-kit");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 value) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const MEMO_ABI = [
  "function memo(address target, bytes data, bytes32 memoId, bytes memoData)",
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)"
];
const MULTICALL3_FROM_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)"
];
const ARC_MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const ARC_MULTICALL3_FROM_ADDRESS = "0x522fAf9A91c41c443c66765030741e4AaCe147D0";
const MAX_MEMO_BYTES = 512;

const TOKENS = {
  USDC: {
    symbol: "USDC",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6
  },
  EURC: {
    symbol: "EURC",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6
  }
};

const ARC_EXPLORER_BASE_URL = "https://testnet.arcscan.app/tx";
const BUNDLED_STORE_PATH = path.join(__dirname, "data", "store.json");
const STORE_PATH = process.env.STORE_PATH
  ? path.resolve(process.env.STORE_PATH)
  : process.env.VERCEL
    ? path.join("/tmp", "arc-wallet-store.json")
    : BUNDLED_STORE_PATH;
const DEFAULT_OWNER_USERNAME = process.env.PAYMENT_LINK_OWNER_USERNAME || "emmanuel";
const DEFAULT_OWNER_EMAIL = process.env.PAYMENT_LINK_OWNER_EMAIL || "emmanuel@example.com";
const DEFAULT_LINK_CURRENCY = (process.env.PAYMENT_LINK_DEFAULT_CURRENCY || "USDC").toUpperCase();
const DEFAULT_LINK_BASE_URL = (process.env.PAYMENT_LINK_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const WALLET_APP_BASE_URL = (process.env.WALLET_APP_BASE_URL || DEFAULT_LINK_BASE_URL || "https://veloxpay.vercel.app").replace(/\/$/, "");
const PAYMENT_LINK_SIGNING_SECRET = process.env.PAYMENT_LINK_SIGNING_SECRET || "veloxpay-demo-secret";
const OTP_CODE_TTL_MINUTES = Math.max(1, Number(process.env.OTP_CODE_TTL_MINUTES || 10));
const OTP_MAX_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS || 5));
const WALLET_SESSION_TTL_DAYS = Math.max(1, Number(process.env.WALLET_SESSION_TTL_DAYS || 30));
const REQUIRE_WALLET_SESSION = String(
  process.env.REQUIRE_WALLET_SESSION || (process.env.NODE_ENV === "production" ? "true" : "false")
).toLowerCase() === "true";
const TRANSFER_HISTORY_LOOKBACK_BLOCKS = Math.max(2000, Number(process.env.TRANSFER_HISTORY_LOOKBACK_BLOCKS || 50000));
const LOG_QUERY_CHUNK_SIZE = Math.max(250, Number(process.env.LOG_QUERY_CHUNK_SIZE || 5000));
const MAX_HISTORY_ITEMS = Math.max(10, Number(process.env.MAX_HISTORY_ITEMS || 20));
const TX_RECEIPT_POLL_INTERVAL_MS = Math.max(2000, Number(process.env.TX_RECEIPT_POLL_INTERVAL_MS || 4000));
const TX_RECEIPT_TIMEOUT_MS = Math.max(15000, Number(process.env.TX_RECEIPT_TIMEOUT_MS || 120000));
const RESEND_API_URL = "https://api.resend.com/emails";
const PERSISTENT_KV_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const PERSISTENT_KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const HAS_PERSISTENT_KV = Boolean(PERSISTENT_KV_URL && PERSISTENT_KV_TOKEN);
const LINK_CURRENCY_CODES = {
  USDC: "1",
  EURC: "2"
};

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || "";
const CIRCLE_API_URL = process.env.CIRCLE_API_URL || "https://api.circle.com";
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET || "";
const CIRCLE_WALLET_SET_ID = process.env.CIRCLE_WALLET_SET_ID || "";
const CIRCLE_WALLET_SET_NAME = process.env.CIRCLE_WALLET_SET_NAME || "Invisible Wallet Set";
const CIRCLE_BLOCKCHAIN = process.env.CIRCLE_BLOCKCHAIN || "ARC-TESTNET";
const ARC_APP_KIT_KEY = process.env.ARC_APP_KIT_KEY || process.env.KIT_KEY || "";
const ENABLE_CIRCLE_WALLETS = Boolean(CIRCLE_API_KEY && CIRCLE_ENTITY_SECRET);
const ENABLE_CIRCLE_WEBHOOK_VERIFICATION = Boolean(CIRCLE_API_KEY);
const ENABLE_CIRCLE_GAS_STATION = String(process.env.CIRCLE_GAS_STATION_ENABLED || "true").toLowerCase() !== "false";
const ENABLE_USER_CONTROLLED_WALLETS = Boolean(process.env.CIRCLE_USER_CONTROLLED_APP_ID);
const ENABLE_ARC_APP_KIT = Boolean(ARC_APP_KIT_KEY);
const ENABLE_ARC_APP_KIT_EXECUTION = Boolean(ARC_APP_KIT_KEY && CIRCLE_API_KEY && CIRCLE_ENTITY_SECRET);
const circleWalletsClient = ENABLE_CIRCLE_WALLETS
  ? initiateDeveloperControlledWalletsClient({
      apiKey: CIRCLE_API_KEY,
      entitySecret: CIRCLE_ENTITY_SECRET
    })
  : null;

const circleWebhookPublicKeyCache = new Map();
const requestRateLimitCache = new Map();

function normalizeOrigin(origin) {
  return origin.replace(/\/$/, "");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeToken(token) {
  return (token || "USDC").toUpperCase();
}

function enforceRateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const entry = requestRateLimitCache.get(key) || { count: 0, resetAt: now + windowMs };

  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  requestRateLimitCache.set(key, entry);

  if (entry.count > limit) {
    const error = new Error("Too many attempts. Please wait a moment and try again.");
    error.statusCode = 429;
    throw error;
  }
}

function normalizeAmount(amount) {
  return Number(amount).toString();
}

function assertPositiveAmount(amount, label = "Amount") {
  const numericAmount = Number(amount);

  if (!String(amount || "").trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
}

function currencyCodeForToken(token) {
  return LINK_CURRENCY_CODES[normalizeToken(token)] || LINK_CURRENCY_CODES[DEFAULT_LINK_CURRENCY] || "1";
}

function tokenFromCurrencyCode(code) {
  return Object.entries(LINK_CURRENCY_CODES).find(([, value]) => value === code)?.[0] || null;
}

function persistentUserEmailKey(email) {
  return `veloxpay:user:email:${normalizeEmail(email)}`;
}

function persistentUserUsernameKey(username) {
  return `veloxpay:user:username:${slugifySegment(username)}`;
}

function persistentPaymentLinkKey(linkCode) {
  return `veloxpay:payment-link:${String(linkCode || "").trim().toLowerCase()}`;
}

function persistentOwnerPaymentLinksKey(email) {
  return `veloxpay:payment-links:owner:${normalizeEmail(email)}`;
}

function persistentOwnerPaymentsKey(email) {
  return `veloxpay:payments:owner:${normalizeEmail(email)}`;
}

function persistentPayerPaymentsKey(email) {
  return `veloxpay:payments:payer:${normalizeEmail(email)}`;
}

function persistentPaymentKey(paymentId) {
  return `veloxpay:payment:${String(paymentId || "").trim()}`;
}

async function runPersistentCommand(command, ...args) {
  if (!HAS_PERSISTENT_KV) {
    return null;
  }

  const response = await fetch(PERSISTENT_KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERSISTENT_KV_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command, ...args.map((value) => String(value))])
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Persistent storage error: ${errorText || response.statusText}`);
  }

  const payload = await response.json();

  if (payload?.error) {
    throw new Error(`Persistent storage error: ${payload.error}`);
  }

  return payload?.result ?? null;
}

async function getPersistentJson(key) {
  const serialized = await runPersistentCommand("GET", key);
  return serialized ? JSON.parse(serialized) : null;
}

async function setPersistentJson(key, value) {
  await runPersistentCommand("SET", key, JSON.stringify(value));
}

async function getPersistentUserByEmail(email) {
  if (!HAS_PERSISTENT_KV) {
    return null;
  }

  return getPersistentJson(persistentUserEmailKey(email));
}

async function getPersistentUserByUsername(username) {
  if (!HAS_PERSISTENT_KV) {
    return null;
  }

  const email = await runPersistentCommand("GET", persistentUserUsernameKey(username));

  if (!email) {
    return null;
  }

  return getPersistentUserByEmail(String(email));
}

async function savePersistentUser(user) {
  if (!HAS_PERSISTENT_KV || !user?.email) {
    return;
  }

  await setPersistentJson(persistentUserEmailKey(user.email), user);

  if (user.username) {
    await runPersistentCommand("SET", persistentUserUsernameKey(user.username), user.email);
  }
}

async function isPersistentUsernameTakenByAnotherUser(username, currentEmail) {
  if (!HAS_PERSISTENT_KV || !username) {
    return false;
  }

  const existingEmail = await runPersistentCommand("GET", persistentUserUsernameKey(username));

  return Boolean(existingEmail && normalizeEmail(existingEmail) !== normalizeEmail(currentEmail));
}

async function getPersistentPaymentLink(linkCode) {
  if (!HAS_PERSISTENT_KV || !linkCode) {
    return null;
  }

  return getPersistentJson(persistentPaymentLinkKey(linkCode));
}

async function savePersistentPaymentLink(paymentLink) {
  if (!HAS_PERSISTENT_KV || !paymentLink?.linkCode || !paymentLink?.ownerEmail) {
    return;
  }

  await setPersistentJson(persistentPaymentLinkKey(paymentLink.linkCode), paymentLink);

  const listKey = persistentOwnerPaymentLinksKey(paymentLink.ownerEmail);
  const existing = await getPersistentJson(listKey);
  const nextLinks = Array.isArray(existing) ? existing : [];
  const deduped = [paymentLink, ...nextLinks.filter((link) => link?.linkCode !== paymentLink.linkCode)].slice(0, 100);
  await setPersistentJson(listKey, deduped);
}

async function listPersistentPaymentLinks(ownerEmail) {
  if (!HAS_PERSISTENT_KV || !ownerEmail) {
    return [];
  }

  const stored = await getPersistentJson(persistentOwnerPaymentLinksKey(ownerEmail));
  return Array.isArray(stored) ? stored : [];
}

async function savePersistentPayment(payment) {
  if (!HAS_PERSISTENT_KV || !payment?.ownerEmail || !payment?.id) {
    return;
  }

  await setPersistentJson(persistentPaymentKey(payment.id), payment);

  const listKey = persistentOwnerPaymentsKey(payment.ownerEmail);
  const existing = await getPersistentJson(listKey);
  const nextPayments = Array.isArray(existing) ? existing : [];
  const deduped = [payment, ...nextPayments.filter((entry) => entry?.id !== payment.id)].slice(0, 100);
  await setPersistentJson(listKey, deduped);

  if (payment.payerEmail) {
    const payerListKey = persistentPayerPaymentsKey(payment.payerEmail);
    const existingPayerPayments = await getPersistentJson(payerListKey);
    const nextPayerPayments = Array.isArray(existingPayerPayments) ? existingPayerPayments : [];
    const dedupedPayerPayments = [payment, ...nextPayerPayments.filter((entry) => entry?.id !== payment.id)].slice(0, 100);
    await setPersistentJson(payerListKey, dedupedPayerPayments);
  }
}

async function listPersistentPayments(ownerEmail) {
  if (!HAS_PERSISTENT_KV || !ownerEmail) {
    return [];
  }

  const stored = await getPersistentJson(persistentOwnerPaymentsKey(ownerEmail));
  return Array.isArray(stored) ? stored : [];
}

async function getPersistentPayment(paymentId) {
  if (!HAS_PERSISTENT_KV || !paymentId) {
    return null;
  }

  return getPersistentJson(persistentPaymentKey(paymentId));
}

async function listPersistentCustomers(ownerEmail) {
  if (!HAS_PERSISTENT_KV || !ownerEmail) {
    return [];
  }

  const stored = await getPersistentJson(`veloxpay:customers:${normalizeEmail(ownerEmail)}`);
  return Array.isArray(stored) ? stored : [];
}

async function savePersistentCustomers(ownerEmail, customers) {
  if (!HAS_PERSISTENT_KV || !ownerEmail) {
    return;
  }

  await setPersistentJson(`veloxpay:customers:${normalizeEmail(ownerEmail)}`, customers);
}

function getTokenConfig(token) {
  return TOKENS[normalizeToken(token)] || null;
}

function buildTokenError() {
  return `Unsupported token. Supported tokens: ${Object.keys(TOKENS).join(", ")}`;
}

function slugifySegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function displayNameFromEmail(email) {
  const localPart = normalizeEmail(email).split("@")[0] || "friend";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();

  if (!cleaned) {
    return "Friend";
  }

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function usernameFromOwner(email, ownerName) {
  return (
    slugifySegment(ownerName)
    || slugifySegment(normalizeEmail(email).split("@")[0])
    || slugifySegment(DEFAULT_OWNER_USERNAME)
    || "member"
  );
}

function buildExplorerUrl(hash) {
  return `${ARC_EXPLORER_BASE_URL}/${hash}`;
}

async function listPersistentPayerPayments(payerEmail) {
  if (!HAS_PERSISTENT_KV || !payerEmail) {
    return [];
  }

  const stored = await getPersistentJson(persistentPayerPaymentsKey(payerEmail));
  return Array.isArray(stored) ? stored : [];
}

function sanitizePublicError(error) {
  const message = String(error?.shortMessage || error?.reason || error?.message || "Unknown error");

  if (message.includes("CALL_EXCEPTION") || message.includes("missing revert data") || message.includes("execution reverted")) {
    return "The token contract could not be reached on Arc Testnet right now.";
  }

  if (message.includes("rate limit") || message.includes("429")) {
    return "Arc RPC is rate-limiting balance requests right now.";
  }

  return message.length > 160 ? `${message.slice(0, 157)}...` : message;
}

function buildMemoPayload({ kind = "transfer", reference = "", note = "", extra = {} } = {}) {
  const normalizedReference = String(reference || `${kind}-${crypto.randomUUID()}`).trim();
  const normalizedNote = String(note || "").trim();
  const payload = {
    app: "VeloxPay",
    kind,
    reference: normalizedReference,
    note: normalizedNote,
    ...extra
  };
  let memoText = JSON.stringify(payload);

  if (Buffer.byteLength(memoText, "utf8") > MAX_MEMO_BYTES) {
    payload.note = normalizedNote.slice(0, 160);
    memoText = JSON.stringify(payload);
  }

  return {
    id: ethers.id(normalizedReference),
    text: memoText,
    reference: normalizedReference,
    note: normalizedNote
  };
}

function getMemoContract(runner) {
  return new ethers.Contract(ARC_MEMO_ADDRESS, MEMO_ABI, runner);
}

function getMulticall3FromContract(runner) {
  return new ethers.Contract(ARC_MULTICALL3_FROM_ADDRESS, MULTICALL3_FROM_ABI, runner);
}

function buildFeatureCapabilities() {
  return {
    network: {
      name: "Arc Testnet",
      blockchain: CIRCLE_BLOCKCHAIN,
      explorerBaseUrl: ARC_EXPLORER_BASE_URL,
      finality: "deterministic-sub-second",
      gasToken: "USDC"
    },
    wallets: {
      developerControlled: ENABLE_CIRCLE_WALLETS,
      userControlled: ENABLE_USER_CONTROLLED_WALLETS,
      defaultAccountType: "SCA",
      gasStation: ENABLE_CIRCLE_WALLETS && ENABLE_CIRCLE_GAS_STATION
    },
    payments: {
      links: true,
      receipts: true,
      recurringRequests: true,
      batchTransfers: true,
      nativeBatchTransfers: true,
      transactionMemos: true,
      simulation: true,
      settlementReports: true
    },
    appKit: {
      available: ENABLE_ARC_APP_KIT,
      bridge: ENABLE_ARC_APP_KIT,
      unifiedBalance: ENABLE_ARC_APP_KIT,
      swaps: ENABLE_ARC_APP_KIT,
      execution: ENABLE_ARC_APP_KIT_EXECUTION
    },
    tokens: Object.keys(TOKENS)
  };
}

function buildUnavailableFeature(featureName, setupHint) {
  return {
    status: "configuration_required",
    feature: featureName,
    message: `${featureName} is wired into VeloxPay, but needs ${setupHint} before live execution.`
  };
}

function buildReadinessReport() {
  const checks = [
    {
      id: "payment_link_secret",
      ok: Boolean(PAYMENT_LINK_SIGNING_SECRET && PAYMENT_LINK_SIGNING_SECRET !== "veloxpay-demo-secret"),
      message: "Set PAYMENT_LINK_SIGNING_SECRET to a strong random value."
    },
    {
      id: "persistent_storage",
      ok: HAS_PERSISTENT_KV,
      message: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for durable production storage."
    },
    {
      id: "circle_developer_wallets",
      ok: ENABLE_CIRCLE_WALLETS,
      message: "Set CIRCLE_API_KEY and a rotated CIRCLE_ENTITY_SECRET for Circle developer-controlled wallets."
    },
    {
      id: "wallet_sessions",
      ok: REQUIRE_WALLET_SESSION,
      message: "Set REQUIRE_WALLET_SESSION=true in production."
    },
    {
      id: "email_delivery",
      ok: Boolean((process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD)) || (process.env.RESEND_API_KEY && process.env.OTP_FROM_EMAIL)),
      message: "Configure SMTP or Resend for OTP delivery."
    },
    {
      id: "app_kit",
      ok: ENABLE_ARC_APP_KIT,
      message: "Set ARC_APP_KIT_KEY for Arc App Kit quote/prep flows."
    },
    {
      id: "app_kit_execution",
      ok: ENABLE_ARC_APP_KIT_EXECUTION,
      message: "Set ARC_APP_KIT_KEY, CIRCLE_API_KEY, and CIRCLE_ENTITY_SECRET for live bridge, swap, and Unified Balance execution."
    },
    {
      id: "user_controlled_wallets",
      ok: ENABLE_USER_CONTROLLED_WALLETS,
      message: "Set CIRCLE_USER_CONTROLLED_APP_ID and add Circle Web SDK challenge execution for user-controlled wallets."
    }
  ];

  return {
    status: checks.every((check) => check.ok) ? "ready" : "action_required",
    generatedAt: new Date().toISOString(),
    checks
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hashOtpCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function encodeBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64UrlToBuffer(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function decodeBase64Url(value) {
  return decodeBase64UrlToBuffer(value).toString("utf8");
}

function createSignature(value, byteLength) {
  const digest = crypto.createHmac("sha256", PAYMENT_LINK_SIGNING_SECRET).update(value).digest();
  return encodeBase64Url(byteLength ? digest.subarray(0, byteLength) : digest);
}

function signValue(value) {
  return createSignature(value, 8);
}

function hasValidSignature(value, signature) {
  return signature === signValue(value) || signature === createSignature(value);
}

function parseSignedPayload(payload) {
  try {
    return JSON.parse(zlib.inflateRawSync(decodeBase64UrlToBuffer(payload)).toString("utf8"));
  } catch {
    try {
      return JSON.parse(decodeBase64Url(payload));
    } catch {
      return null;
    }
  }
}

function buildSignedPaymentLinkCode(paymentLink) {
  const compactPayload = {
    e: paymentLink.ownerEmail,
    n: paymentLink.ownerName,
    a: paymentLink.amount,
    d: paymentLink.description,
    c: paymentLink.currency,
    i: paymentLink.id
  };
  const payload = encodeBase64Url(
    zlib.deflateRawSync(Buffer.from(JSON.stringify(compactPayload), "utf8"), { level: 9 })
  );

  return `${payload}.${signValue(payload)}`;
}

function buildPaymentLinkToken(paymentLink) {
  const compactPayload = {
    e: paymentLink.ownerEmail,
    n: paymentLink.ownerName,
    u: paymentLink.username,
    a: paymentLink.amount,
    d: paymentLink.description,
    c: paymentLink.currency,
    i: paymentLink.linkCode || paymentLink.id,
    r: paymentLink.recurrence?.interval || "one-time",
    ce: paymentLink.customerEmail || "",
    cn: paymentLink.customerName || ""
  };

  const payload = encodeBase64Url(
    zlib.deflateRawSync(Buffer.from(JSON.stringify(compactPayload), "utf8"), { level: 9 })
  );

  return `${payload}.${signValue(payload)}`;
}

function generateShortPaymentLinkCode({ username, amount, currency }) {
  const currencyCode = currencyCodeForToken(currency);
  const timestampHex = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0").slice(-8);
  const nonceHex = crypto.randomBytes(3).toString("hex").slice(0, 5);
  const signatureHex = crypto
    .createHmac("sha256", PAYMENT_LINK_SIGNING_SECRET)
    .update(`${slugifySegment(username)}|${normalizeAmount(amount)}|${normalizeToken(currency)}|${timestampHex}|${nonceHex}`)
    .digest("hex")
    .slice(0, 6);

  return `${currencyCode}${timestampHex}${nonceHex}${signatureHex}`;
}

async function getStoredUserByUsername(store, username) {
  const normalizedUsername = slugifySegment(username);

  if (!normalizedUsername) {
    return null;
  }

  const localUser = Object.values(store.users).find((user) => user.username === normalizedUsername) || null;

  if (localUser) {
    return localUser;
  }

  const persistentUser = await getPersistentUserByUsername(normalizedUsername);

  if (persistentUser?.email) {
    store.users[normalizeEmail(persistentUser.email)] = persistentUser;
  }

  return persistentUser || null;
}

async function readCompactPaymentLinkFromRoute(store, { linkId, username, amount, currency }) {
  const normalizedLinkId = String(linkId || "").trim().toLowerCase();
  const normalizedUsername = slugifySegment(username);
  const normalizedAmount = normalizeAmount(amount);
  const currencyCode = normalizedLinkId.slice(0, 1);
  const derivedCurrency = tokenFromCurrencyCode(currencyCode);

  if (!/^[a-f0-9]{20}$/.test(normalizedLinkId) || !normalizedUsername || !normalizedAmount || !derivedCurrency) {
    return null;
  }

  const normalizedCurrency = normalizeToken(currency || derivedCurrency);

  if (normalizedCurrency !== derivedCurrency) {
    return null;
  }

  const timestampHex = normalizedLinkId.slice(1, 9);
  const nonceHex = normalizedLinkId.slice(9, 14);
  const signatureHex = normalizedLinkId.slice(14);
  const expectedSignature = crypto
    .createHmac("sha256", PAYMENT_LINK_SIGNING_SECRET)
    .update(`${normalizedUsername}|${normalizedAmount}|${derivedCurrency}|${timestampHex}|${nonceHex}`)
    .digest("hex")
    .slice(0, 6);

  if (signatureHex !== expectedSignature) {
    return null;
  }

  const user = await getStoredUserByUsername(store, normalizedUsername);

  if (!user) {
    return null;
  }

  const createdAt = new Date(parseInt(timestampHex, 16) * 1000).toISOString();

  return {
    id: normalizedLinkId,
    linkCode: normalizedLinkId,
    ownerEmail: normalizeEmail(user.email),
    ownerName: user.displayName || displayNameFromEmail(user.email),
    username: normalizedUsername,
    recipientAddress: user.address || walletFromEmail(user.email).signer.address,
    amount: normalizedAmount,
    description: "",
    currency: derivedCurrency,
    status: "active",
    createdAt
  };
}

function readPaymentLinkFromToken(linkToken) {
  const [payload, signature] = String(linkToken || "").split(".");

  if (!payload || !signature || !hasValidSignature(payload, signature)) {
    return null;
  }

  const parsed = parseSignedPayload(payload);

  if (!parsed) {
    return null;
  }

  const ownerEmail = parsed.e || parsed.ownerEmail;
  const ownerName = parsed.n || parsed.ownerName;
  const username = parsed.u || parsed.username;
  const amount = parsed.a || parsed.amount;
  const description = parsed.d || parsed.description;
  const currency = parsed.c || parsed.currency;
  const linkCode = parsed.i || parsed.linkCode || parsed.id;
  const recurrence = parsed.r || parsed.recurrence;
  const customerEmail = parsed.ce || parsed.customerEmail;
  const customerName = parsed.cn || parsed.customerName;

  if (!ownerEmail || !amount || !currency || !username || !linkCode) {
    return null;
  }

  const { signer } = walletFromEmail(ownerEmail);
  const resolvedOwnerName = ownerName || displayNameFromEmail(ownerEmail);

  return {
    id: linkCode,
    linkCode,
    linkToken,
    ownerEmail: normalizeEmail(ownerEmail),
    ownerName: resolvedOwnerName,
    username: slugifySegment(username),
    recipientAddress: signer.address,
    amount: normalizeAmount(amount),
    description: description || "",
    currency: normalizeToken(currency),
    recurrence: {
      interval: recurrence || "one-time"
    },
    customerEmail: customerEmail ? normalizeEmail(customerEmail) : "",
    customerName: customerName || "",
    status: "active",
    createdAt: new Date().toISOString()
  };
}

function readPaymentLinkFromCode(linkCode) {
  const [payload, signature] = String(linkCode || "").split(".");

  if (!payload || !signature || !hasValidSignature(payload, signature)) {
    return null;
  }

  const parsed = parseSignedPayload(payload);

  if (!parsed) {
    return null;
  }

  const ownerEmail = parsed.e || parsed.ownerEmail;
  const ownerName = parsed.n || parsed.ownerName;
  const amount = parsed.a || parsed.amount;
  const description = parsed.d || parsed.description;
  const currency = parsed.c || parsed.currency;
  const nonce = parsed.i || parsed.nonce;

  if (!ownerEmail || !amount || !currency) {
    return null;
  }

  const { signer } = walletFromEmail(ownerEmail);
  const resolvedOwnerName = ownerName || displayNameFromEmail(ownerEmail);

  return {
    id: nonce || linkCode,
    linkCode,
    ownerEmail: normalizeEmail(ownerEmail),
    ownerName: resolvedOwnerName,
    username: usernameFromOwner(ownerEmail, resolvedOwnerName),
    recipientAddress: signer.address,
    amount: normalizeAmount(amount),
    description: description || "",
    currency: normalizeToken(currency),
    status: "active",
    createdAt: parsed.createdAt || new Date().toISOString()
  };
}

function buildPaymentChallengeToken({ linkId, payerEmail, codeHash, expiresAt, linkToken }) {
  const payload = encodeBase64Url(JSON.stringify({
    linkId,
    payerEmail,
    codeHash,
    expiresAt,
    linkToken: String(linkToken || "")
  }));

  return `${payload}.${signValue(payload)}`;
}

function readPaymentChallengeToken(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature || signValue(payload) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));

    if (!parsed?.linkId || !parsed?.payerEmail || !parsed?.codeHash || !parsed?.expiresAt) {
      return null;
    }

    return {
      linkId: String(parsed.linkId),
      payerEmail: normalizeEmail(parsed.payerEmail),
      codeHash: String(parsed.codeHash),
      expiresAt: String(parsed.expiresAt),
      linkToken: String(parsed.linkToken || "")
    };
  } catch {
    return null;
  }
}

function buildWalletLoginChallengeToken({ email, displayName, codeHash, expiresAt }) {
  const payload = encodeBase64Url(JSON.stringify({
    email: normalizeEmail(email),
    displayName: String(displayName || "").trim(),
    codeHash,
    expiresAt
  }));

  return `${payload}.${signValue(payload)}`;
}

function readWalletLoginChallengeToken(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature || signValue(payload) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));

    if (!parsed?.email || !parsed?.codeHash || !parsed?.expiresAt) {
      return null;
    }

    return {
      email: normalizeEmail(parsed.email),
      displayName: String(parsed.displayName || "").trim(),
      codeHash: String(parsed.codeHash),
      expiresAt: String(parsed.expiresAt)
    };
  } catch {
    return null;
  }
}

function createEmptyStore() {
  return {
    users: {},
    wallets: {},
    walletSetId: null,
    txs: [],
    paymentLinks: [],
    smartRequests: [],
    payments: [],
    paymentAuthSessions: [],
    customers: []
  };
}

function ensureStoreFile() {
  const storeDir = path.dirname(STORE_PATH);

  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    if (STORE_PATH !== BUNDLED_STORE_PATH && fs.existsSync(BUNDLED_STORE_PATH)) {
      fs.copyFileSync(BUNDLED_STORE_PATH, STORE_PATH);
      return;
    }

    fs.writeFileSync(STORE_PATH, JSON.stringify(createEmptyStore(), null, 2));
  }
}

function readStore() {
  ensureStoreFile();

  const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));

  return {
    ...createEmptyStore(),
    ...parsed,
    users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
    txs: Array.isArray(parsed.txs) ? parsed.txs : [],
    paymentLinks: Array.isArray(parsed.paymentLinks) ? parsed.paymentLinks : [],
    smartRequests: Array.isArray(parsed.smartRequests) ? parsed.smartRequests : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    paymentAuthSessions: Array.isArray(parsed.paymentAuthSessions) ? parsed.paymentAuthSessions : [],
    customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    walletSetId: parsed.walletSetId || null
  };
}

function writeStore(store) {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCircleWalletSetId(store) {
  if (!ENABLE_CIRCLE_WALLETS || !circleWalletsClient) {
    return null;
  }

  if (CIRCLE_WALLET_SET_ID) {
    return CIRCLE_WALLET_SET_ID;
  }

  if (store.walletSetId) {
    return store.walletSetId;
  }

  const response = await circleWalletsClient.createWalletSet({
    name: CIRCLE_WALLET_SET_NAME
  });

  const walletSetId = response?.data?.walletSet?.id;

  if (!walletSetId) {
    throw new Error("Circle wallet set creation failed");
  }

  store.walletSetId = walletSetId;
  writeStore(store);
  return walletSetId;
}

async function fetchCircleWebhookPublicKey(keyId) {
  if (!keyId) {
    throw new Error("Circle webhook key ID is required");
  }

  if (circleWebhookPublicKeyCache.has(keyId)) {
    return circleWebhookPublicKeyCache.get(keyId);
  }

  const response = await fetch(`${CIRCLE_API_URL}/v2/cpn/notifications/publicKey/${encodeURIComponent(keyId)}`, {
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch Circle webhook public key: ${response.status} ${body}`);
  }

  const data = await response.json();
  const publicKeyBase64 = data?.data?.publicKey;
  const algorithm = data?.data?.algorithm;

  if (!publicKeyBase64 || !algorithm) {
    throw new Error("Invalid Circle public key response");
  }

  const publicKey = crypto.createPublicKey({
    key: Buffer.from(publicKeyBase64, "base64"),
    format: "der",
    type: "spki"
  });

  circleWebhookPublicKeyCache.set(keyId, { publicKey, algorithm });
  return { publicKey, algorithm };
}

async function verifyCircleWebhookSignature(req) {
  const signature = req.headers["x-circle-signature"] || req.headers["X-Circle-Signature"];
  const keyId = req.headers["x-circle-key-id"] || req.headers["X-Circle-Key-Id"];

  if (!signature || !keyId) {
    throw new Error("Missing Circle webhook signature headers");
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body), "utf8");
  const signatureBytes = Buffer.from(String(signature), "base64");
  const { publicKey, algorithm } = await fetchCircleWebhookPublicKey(String(keyId).trim());

  if (algorithm !== "ECDSA_SHA_256") {
    throw new Error(`Unsupported Circle webhook algorithm: ${algorithm}`);
  }

  const verified = crypto.verify("sha256", rawBody, publicKey, signatureBytes);

  if (!verified) {
    throw new Error("Invalid Circle webhook signature");
  }
}

async function createCircleWallet(store) {
  const walletSetId = await getCircleWalletSetId(store);

  if (!walletSetId) {
    throw new Error("Circle wallet integration is not configured");
  }

  const response = await circleWalletsClient.createWallets({
    walletSetId,
    blockchains: [CIRCLE_BLOCKCHAIN],
    count: 1,
    accountType: "SCA"
  });

  const wallet = response?.data?.wallets?.[0];

  if (!wallet?.id || !wallet?.address) {
    throw new Error("Circle wallet creation failed");
  }

  return {
    walletId: wallet.id,
    walletAddress: wallet.address,
    walletSetId,
    blockchain: CIRCLE_BLOCKCHAIN
  };
}

async function executeCircleTokenTransfer(user, to, amount, tokenConfig, memoPayload = null) {
  if (!ENABLE_CIRCLE_WALLETS || !circleWalletsClient) {
    throw new Error("Circle wallet integration is not enabled");
  }

  const walletAddress = user.walletAddress || user.address;
  const blockchain = user.blockchain || CIRCLE_BLOCKCHAIN;

  if (!walletAddress) {
    throw new Error("User wallet address is not available for Circle transaction");
  }

  const transferResponse = await circleWalletsClient.createTransaction({
    idempotencyKey: crypto.randomUUID(),
    blockchain,
    walletAddress,
    tokenAddress: tokenConfig.address,
    destinationAddress: to,
    amount: [String(amount)],
    fee: {
      type: "level",
      config: { feeLevel: "MEDIUM" }
    }
  });

  const transactionId = transferResponse?.data?.id;
  if (!transactionId) {
    throw new Error("Circle transaction creation failed");
  }

  let transaction;
  const terminalStates = new Set(["COMPLETE", "FAILED", "CANCELLED", "DENIED"]);
  const maxPolls = 40;
  let pollCount = 0;

  while (pollCount < maxPolls) {
    await sleep(3000);
    const pollResponse = await circleWalletsClient.getTransaction({ id: transactionId });
    transaction = pollResponse?.data?.transaction;

    if (!transaction) {
      pollCount += 1;
      continue;
    }

    if (terminalStates.has(transaction.state)) {
      break;
    }

    pollCount += 1;
  }

  if (!transaction || transaction.state !== "COMPLETE") {
    throw new Error(`Circle transaction failed or did not complete: ${transaction?.state || "unknown"}`);
  }

  const txHash = transaction.txHash || transaction.transactionHash || "";

  return {
    status: "ok",
    settlementState: "final",
    settlementNetwork: "Arc Testnet",
    hash: txHash,
    transactionId,
    from: walletAddress,
    to,
    amount: String(amount),
    token: tokenConfig.symbol,
    symbol: tokenConfig.symbol,
    memo: memoPayload?.text || "",
    memoId: memoPayload?.id || "",
    memoReference: memoPayload?.reference || "",
    memoMode: memoPayload ? "veloxpay-record" : "none",
    explorer: buildExplorerUrl(txHash)
  };
}

async function syncStoredPaymentLink(store, paymentLink) {
  if (!paymentLink?.linkCode) {
    return paymentLink;
  }

  const index = store.paymentLinks.findIndex((entry) => entry.linkCode === paymentLink.linkCode || entry.id === paymentLink.id);

  if (index >= 0) {
    store.paymentLinks[index] = {
      ...store.paymentLinks[index],
      ...paymentLink
    };
  } else {
    store.paymentLinks.push(paymentLink);
  }

  await savePersistentPaymentLink(paymentLink);
  return paymentLink;
}

function cleanExpiredPaymentSessions(store) {
  const now = Date.now();
  store.paymentAuthSessions = store.paymentAuthSessions.filter((session) => {
    return new Date(session.expiresAt).getTime() > now && !session.usedAt;
  });
}

function buildPaymentLinkPath(paymentLink) {
  if (paymentLink.linkCode && paymentLink.username && paymentLink.amount) {
    return `/${paymentLink.username}/${paymentLink.amount}/${paymentLink.linkCode}`;
  }

  if (paymentLink.linkCode) {
    return `/pay/${paymentLink.linkCode}`;
  }

  return `/${paymentLink.username}/${paymentLink.amount}`;
}

function buildPaymentLinkUrl(paymentLink) {
  return `${DEFAULT_LINK_BASE_URL}${buildPaymentLinkPath(paymentLink)}`;
}

function buildReceiptUrl(paymentId, ownerEmail = "") {
  const receiptUrl = `${DEFAULT_LINK_BASE_URL}/receipt/${paymentId}`;
  return ownerEmail ? `${receiptUrl}?ownerEmail=${encodeURIComponent(normalizeEmail(ownerEmail))}` : receiptUrl;
}

function hydratePaymentLinkAccess(paymentLink) {
  if (!paymentLink || !paymentLink.linkCode) {
    return paymentLink;
  }

  if (!paymentLink.linkToken) {
    paymentLink.linkToken = buildPaymentLinkToken(paymentLink);
  }

  return paymentLink;
}

function buildPaymentLinkLabel(paymentLink) {
  if (paymentLink.linkCode && paymentLink.username && paymentLink.amount) {
    return `/${paymentLink.username}/${paymentLink.amount}/${paymentLink.linkCode}`;
  }

  if (paymentLink.linkCode) {
    return `/pay/${paymentLink.linkCode}`;
  }

  return `/${paymentLink.username}/${paymentLink.amount}`;
}

function createTimelineEvent(status, label, details) {
  return {
    id: crypto.randomUUID(),
    status,
    label,
    details: details || "",
    at: new Date().toISOString()
  };
}

function appendTimelineEvent(entity, status, label, details) {
  entity.timeline = Array.isArray(entity.timeline) ? entity.timeline : [];
  entity.timeline.push(createTimelineEvent(status, label, details));
  return entity;
}

function setTimelineEventOnce(entity, status, label, details) {
  entity.timeline = Array.isArray(entity.timeline) ? entity.timeline : [];

  if (!entity.timeline.some((event) => event.status === status)) {
    entity.timeline.push(createTimelineEvent(status, label, details));
  }

  return entity;
}

function buildRecurrence(interval = "one-time", createdAt = new Date().toISOString()) {
  const normalized = ["weekly", "monthly"].includes(String(interval)) ? String(interval) : "one-time";

  if (normalized === "one-time") {
    return {
      interval: normalized,
      label: "One-time request"
    };
  }

  const nextDueAt = new Date(createdAt);

  if (normalized === "weekly") {
    nextDueAt.setDate(nextDueAt.getDate() + 7);
  } else {
    nextDueAt.setMonth(nextDueAt.getMonth() + 1);
  }

  return {
    interval: normalized,
    label: normalized === "weekly" ? "Weekly request" : "Monthly request",
    nextDueAt: nextDueAt.toISOString()
  };
}

function rememberCustomer(store, ownerEmail, customer) {
  const normalizedOwnerEmail = normalizeEmail(ownerEmail);
  const normalizedCustomerEmail = normalizeEmail(customer?.email);

  if (!normalizedOwnerEmail || !normalizedCustomerEmail) {
    return [];
  }

  const customers = Array.isArray(store.customers) ? store.customers : [];
  const nextCustomer = {
    ownerEmail: normalizedOwnerEmail,
    email: normalizedCustomerEmail,
    name: String(customer?.name || "").trim(),
    lastPaidAt: customer?.lastPaidAt || new Date().toISOString()
  };
  store.customers = [
    nextCustomer,
    ...customers.filter((entry) => (
      normalizeEmail(entry.ownerEmail) !== normalizedOwnerEmail
      || normalizeEmail(entry.email) !== normalizedCustomerEmail
    ))
  ].slice(0, 50);

  return store.customers
    .filter((entry) => entry.ownerEmail === normalizedOwnerEmail)
    .slice(0, 20);
}

function buildWalletCreateUrl(email, paymentLink) {
  const params = new URLSearchParams();
  params.set("email", normalizeEmail(email));
  params.set("source", "veloxpay");

  if (paymentLink) {
    params.set("returnTo", buildPaymentLinkUrl(paymentLink));
  }

  return `${WALLET_APP_BASE_URL}/login?${params.toString()}`;
}

async function buildUniqueUsername(store, baseUsername, currentEmail) {
  const fallbackUsername = slugifySegment(baseUsername) || slugifySegment(DEFAULT_OWNER_USERNAME) || "member";
  const taken = new Set(
    Object.values(store.users)
      .filter((user) => user.email !== currentEmail)
      .map((user) => user.username)
      .filter(Boolean)
  );

  if (!taken.has(fallbackUsername) && !(await isPersistentUsernameTakenByAnotherUser(fallbackUsername, currentEmail))) {
    return fallbackUsername;
  }

  let suffix = 2;
  while (
    taken.has(`${fallbackUsername}-${suffix}`)
    || await isPersistentUsernameTakenByAnotherUser(`${fallbackUsername}-${suffix}`, currentEmail)
  ) {
    suffix += 1;
  }

  return `${fallbackUsername}-${suffix}`;
}

async function ensureUserRecord(store, { email, displayName }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email required");
  }

  const existingUser = store.users[normalizedEmail] || await getPersistentUserByEmail(normalizedEmail);
  const nextDisplayName = String(displayName || existingUser?.displayName || displayNameFromEmail(normalizedEmail)).trim();
  const baseUsername = slugifySegment(nextDisplayName) || slugifySegment(normalizedEmail.split("@")[0]) || "member";

  if (existingUser) {
    if (!existingUser.username) {
      existingUser.username = await buildUniqueUsername(store, baseUsername, normalizedEmail);
    }

    if (displayName) {
      existingUser.displayName = nextDisplayName;
    } else if (!existingUser.displayName) {
      existingUser.displayName = displayNameFromEmail(normalizedEmail);
    }

    if (ENABLE_CIRCLE_WALLETS && !existingUser.walletAddress) {
      const wallet = await createCircleWallet(store);
      existingUser.walletAddress = wallet.walletAddress;
      existingUser.walletId = wallet.walletId;
      existingUser.walletSetId = wallet.walletSetId;
      existingUser.blockchain = wallet.blockchain;
      existingUser.address = wallet.walletAddress;
    }

    existingUser.updatedAt = new Date().toISOString();
    store.users[normalizedEmail] = existingUser;
    await savePersistentUser(existingUser);
    return existingUser;
  }

  const { signer, arcKeyId } = walletFromEmail(normalizedEmail);
  const user = {
    email: normalizedEmail,
    address: signer.address,
    arcKeyId,
    displayName: nextDisplayName,
    username: await buildUniqueUsername(store, baseUsername, normalizedEmail),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (ENABLE_CIRCLE_WALLETS) {
    const wallet = await createCircleWallet(store);
    user.walletAddress = wallet.walletAddress;
    user.walletId = wallet.walletId;
    user.walletSetId = wallet.walletSetId;
    user.blockchain = wallet.blockchain;
    user.address = wallet.walletAddress;
  }

  store.users[normalizedEmail] = user;
  await savePersistentUser(user);
  return user;
}

async function getStoredUser(store, email) {
  const normalizedEmail = normalizeEmail(email);

  if (store.users[normalizedEmail]) {
    return store.users[normalizedEmail];
  }

  const persistentUser = await getPersistentUserByEmail(normalizedEmail);

  if (persistentUser?.email) {
    store.users[normalizedEmail] = persistentUser;
  }

  return persistentUser || null;
}

async function resolvePaymentLink(store, { linkId, username, amount, linkToken, currency }) {
  const normalizedLinkId = String(linkId || "").trim();
  const normalizedUsername = username ? slugifySegment(username) : "";
  const normalizedAmount = amount ? String(amount).trim() : "";
  const normalizedLinkToken = String(linkToken || "").trim();
  const normalizedCurrency = currency ? normalizeToken(currency) : "";
  const persistentLink = normalizedLinkId ? await getPersistentPaymentLink(normalizedLinkId) : null;

  if (persistentLink) {
    if (
      (!normalizedUsername || persistentLink.username === normalizedUsername) &&
      (!normalizedAmount || persistentLink.amount === normalizedAmount) &&
      (!normalizedCurrency || persistentLink.currency === normalizedCurrency)
    ) {
      hydratePaymentLinkAccess(persistentLink);
      persistentLink.url = buildPaymentLinkUrl(persistentLink);
      return persistentLink;
    }
  }

  const fromCompactRoute = normalizedLinkId && normalizedUsername && normalizedAmount
    ? await readCompactPaymentLinkFromRoute(store, {
      linkId: normalizedLinkId,
      username: normalizedUsername,
      amount: normalizedAmount,
      currency: normalizedCurrency || undefined
    })
    : null;

  if (fromCompactRoute) {
    fromCompactRoute.url = buildPaymentLinkUrl(fromCompactRoute);
    return fromCompactRoute;
  }

  const fromToken = normalizedLinkToken ? readPaymentLinkFromToken(normalizedLinkToken) : null;

  if (fromToken) {
    if (
      (!normalizedUsername || fromToken.username === normalizedUsername) &&
      (!normalizedAmount || fromToken.amount === normalizedAmount) &&
      (!normalizedCurrency || fromToken.currency === normalizedCurrency) &&
      (!normalizedLinkId || fromToken.linkCode === normalizedLinkId || fromToken.id === normalizedLinkId)
    ) {
      fromToken.url = buildPaymentLinkUrl(fromToken);
      return fromToken;
    }
  }

  const fromCode = normalizedLinkId ? readPaymentLinkFromCode(normalizedLinkId) : null;

  if (fromCode) {
    if (
      (!normalizedUsername || fromCode.username === normalizedUsername) &&
      (!normalizedAmount || fromCode.amount === normalizedAmount) &&
      (!normalizedCurrency || fromCode.currency === normalizedCurrency)
    ) {
      hydratePaymentLinkAccess(fromCode);
      fromCode.url = buildPaymentLinkUrl(fromCode);
      return fromCode;
    }
  }

  const candidates = [...store.paymentLinks].reverse();

  const storedLink = candidates.find((link) => {
    if (normalizedUsername && link.username !== normalizedUsername) {
      return false;
    }

    if (normalizedAmount && link.amount !== normalizedAmount) {
      return false;
    }

    if (link.status !== "active") {
      return false;
    }

    if (!normalizedLinkId) {
      return true;
    }

    return link.linkCode === normalizedLinkId || link.id === normalizedLinkId;
  }) || null;

  if (!storedLink) {
    return null;
  }

  hydratePaymentLinkAccess(storedLink);
  storedLink.url = buildPaymentLinkUrl(storedLink);
  return storedLink;
}

async function fetchBlockTimestamp(blockNumber, cache) {
  if (!blockNumber) {
    return new Date().toISOString();
  }

  if (!cache.has(blockNumber)) {
    cache.set(
      blockNumber,
      provider.getBlock(blockNumber).then((block) => (
        block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString()
      ))
    );
  }

  return cache.get(blockNumber);
}

function isLogRangeError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("eth_getLogs is limited to a 10,000 range")
    || message.includes("query returned more than")
    || message.includes("block range")
    || message.includes("-32614")
  );
}

function isRateLimitError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("100/second request limit reached")
    || message.includes("rate limit")
    || message.includes("429")
    || message.includes("-32007")
  );
}

async function queryFilterInChunks(contract, filter, fromBlock, toBlock, chunkSize = LOG_QUERY_CHUNK_SIZE) {
  if (fromBlock > toBlock) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error("Invalid log query chunk size");
  }

  const logs = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(toBlock, start + chunkSize - 1);

    try {
      const batch = await contract.queryFilter(filter, start, end);
      logs.push(...batch);
    } catch (error) {
      if (isLogRangeError(error) && chunkSize > 250) {
        const smallerChunkSize = Math.max(250, Math.floor(chunkSize / 2));
        const fallbackLogs = await queryFilterInChunks(contract, filter, start, end, smallerChunkSize);
        logs.push(...fallbackLogs);
        continue;
      }

      throw error;
    }
  }

  return logs;
}

async function fetchTokenTransferHistory(address, { direction = "all" } = {}) {
  if (!ethers.isAddress(address)) {
    return [];
  }

  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - TRANSFER_HISTORY_LOOKBACK_BLOCKS);
  const addressLower = address.toLowerCase();
  const timestampCache = new Map();

  const transfers = await Promise.all(
    Object.values(TOKENS).map(async (tokenConfig) => {
      const contract = getTokenContract(tokenConfig.symbol);
      const outgoingFilter = contract.filters.Transfer(address, null);
      const incomingFilter = contract.filters.Transfer(null, address);

      const [outgoingLogs, incomingLogs, decimals] = await Promise.all([
        direction === "incoming" ? Promise.resolve([]) : queryFilterInChunks(contract, outgoingFilter, fromBlock, latestBlock),
        direction === "outgoing" ? Promise.resolve([]) : queryFilterInChunks(contract, incomingFilter, fromBlock, latestBlock),
        contract.decimals()
      ]);

      const seen = new Set();
      const mergedLogs = [...incomingLogs, ...outgoingLogs]
        .sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) {
            return b.blockNumber - a.blockNumber;
          }

          return (b.index || 0) - (a.index || 0);
        })
        .filter((log) => {
          const key = `${log.transactionHash}-${log.index}-${tokenConfig.symbol}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        })
        .slice(0, MAX_HISTORY_ITEMS);

      return Promise.all(
        mergedLogs.map(async (log) => {
          const parsed = contract.interface.parseLog(log);
          const from = String(parsed?.args?.from || "");
          const to = String(parsed?.args?.to || "");
          const value = parsed?.args?.value;

          if (
            direction === "incoming" && to.toLowerCase() !== addressLower
            || direction === "outgoing" && from.toLowerCase() !== addressLower
          ) {
            return null;
          }

          return {
            id: `${tokenConfig.symbol}-${log.transactionHash}-${log.index}`,
            hash: log.transactionHash,
            transactionHash: log.transactionHash,
            from,
            to,
            amount: ethers.formatUnits(value, decimals),
            symbol: tokenConfig.symbol,
            token: tokenConfig.symbol,
            currency: tokenConfig.symbol,
            status: "confirmed",
            explorer: buildExplorerUrl(log.transactionHash),
            explorerUrl: buildExplorerUrl(log.transactionHash),
            timestamp: await fetchBlockTimestamp(log.blockNumber, timestampCache),
            paidAt: await fetchBlockTimestamp(log.blockNumber, timestampCache)
          };
        })
      );
    })
  );

  return transfers
    .flat()
    .filter(Boolean)
    .sort((a, b) => new Date(b.timestamp || b.paidAt).getTime() - new Date(a.timestamp || a.paidAt).getTime());
}

async function waitForTransactionReceiptWithBackoff(hash) {
  const startedAt = Date.now();
  let delay = TX_RECEIPT_POLL_INTERVAL_MS;

  while (Date.now() - startedAt < TX_RECEIPT_TIMEOUT_MS) {
    try {
      const receipt = await provider.getTransactionReceipt(hash);
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      if (!isRateLimitError(error)) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay + 1000, 10000);
  }

  throw new Error("Transaction was sent but confirmation is taking too long. Please check Arc Explorer in a moment.");
}

async function sendEmailMessage({ to, subject, html }) {
  const smtpUser = normalizeEmail(process.env.SMTP_USER);
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure = String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false";
  const smtpFrom = process.env.OTP_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || smtpUser;

  if (smtpUser && smtpPass && smtpFrom) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html
      });
    } catch (error) {
      const message = String(error?.message || "");

      if (
        message.includes("535-5.7.8")
        || message.includes("BadCredentials")
        || message.includes("Username and Password not accepted")
      ) {
        throw new Error(
          "Gmail rejected the login. Turn on 2-Step Verification for the Gmail account and set SMTP_PASS to a Google App Password, not the normal Gmail password."
        );
      }

      throw error;
    }
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.OTP_FROM_EMAIL;

  if (!apiKey || !resendFrom) {
    throw new Error("Email verification is not configured yet. Add Gmail SMTP env vars or RESEND_API_KEY and OTP_FROM_EMAIL.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject,
      html
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unable to send verification code. ${errorText || "Please try again."}`);
  }
}

async function sendVerificationCodeEmail({ to, code, paymentLink }) {
  const subject = `${code} is your VeloxPay verification code`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #2563eb;">VeloxPay</p>
      <h1 style="font-size: 24px; margin-bottom: 12px;">Confirm your payment</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Use this verification code to approve your payment of
        <strong>${escapeHtml(paymentLink.amount)} ${escapeHtml(paymentLink.currency)}</strong>
        to <strong>${escapeHtml(paymentLink.ownerName || paymentLink.username)}</strong>.
      </p>
      <div style="margin: 24px 0; padding: 18px 22px; border-radius: 16px; background: #eff6ff; font-size: 30px; font-weight: 700; letter-spacing: 0.28em; color: #1d4ed8; text-align: center;">
        ${escapeHtml(code)}
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
        This code expires in ${OTP_CODE_TTL_MINUTES} minutes. If you did not request this payment, you can ignore this email.
      </p>
    </div>
  `;

  await sendEmailMessage({ to, subject, html });
}

async function sendWalletLoginCodeEmail({ to, code, displayName }) {
  const subject = `${code} is your VeloxPay login code`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #2563eb;">VeloxPay</p>
      <h1 style="font-size: 24px; margin-bottom: 12px;">Confirm your wallet access</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Use this code to ${displayName ? "continue as " : "finish signing in to "}
        <strong>${escapeHtml(displayName || normalizeEmail(to))}</strong>.
      </p>
      <div style="margin: 24px 0; padding: 18px 22px; border-radius: 16px; background: #eff6ff; font-size: 30px; font-weight: 700; letter-spacing: 0.28em; color: #1d4ed8; text-align: center;">
        ${escapeHtml(code)}
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
        This code expires in ${OTP_CODE_TTL_MINUTES} minutes. If this was not you, you can ignore this email.
      </p>
    </div>
  `;

  await sendEmailMessage({ to, subject, html });
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter(Boolean);

const app = express();
app.disable("x-powered-by");
app.use(express.json({
  verify(req, res, buf) {
    req.rawBody = buf;
  }
}));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC || "https://rpc.testnet.arc.network");
provider.pollingInterval = TX_RECEIPT_POLL_INTERVAL_MS;

function walletFromEmail(email) {
  const normalizedEmail = normalizeEmail(email) || "default";
  const hash = ethers.keccak256(ethers.toUtf8Bytes(normalizedEmail));
  const arcKeyId = `arc-${hash.slice(2, 12)}`;
  const privateKey = ethers.keccak256(ethers.toUtf8Bytes(arcKeyId));
  return {
    signer: new ethers.Wallet(privateKey, provider),
    arcKeyId
  };
}

function getTokenContract(token, runner = provider) {
  const tokenConfig = getTokenConfig(token);

  if (!tokenConfig) {
    throw new Error(buildTokenError());
  }

  return new ethers.Contract(tokenConfig.address, ERC20_ABI, runner);
}

function mapStoredUser(user, options = {}) {
  if (!user) {
    return null;
  }

  const mappedUser = {
    email: user.email,
    address: user.address,
    walletId: user.walletId || null,
    arcKeyId: user.arcKeyId,
    displayName: user.displayName,
    username: user.username,
    custodyType: user.walletId ? "circle-developer-controlled" : "local-demo",
    accountType: user.walletId ? "SCA" : "EOA",
    gasMode: user.walletId && ENABLE_CIRCLE_GAS_STATION ? "sponsored" : "usdc-native",
    network: "arc-testnet"
  };

  if (options.includeSession) {
    mappedUser.sessionToken = buildWalletSessionToken({ email: user.email });
  }

  return mappedUser;
}

function buildWalletSessionToken({ email }) {
  const expiresAt = new Date(Date.now() + WALLET_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const payload = encodeBase64Url(JSON.stringify({
    email: normalizeEmail(email),
    expiresAt,
    purpose: "wallet-session"
  }));

  return `${payload}.${signValue(payload)}`;
}

function readWalletSessionToken(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature || signValue(payload) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));

    if (parsed?.purpose !== "wallet-session" || !parsed?.email || !parsed?.expiresAt) {
      return null;
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return {
      email: normalizeEmail(parsed.email),
      expiresAt: String(parsed.expiresAt)
    };
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const [name, ...valueParts] = entry.split("=");
      cookies[name] = decodeURIComponent(valueParts.join("=") || "");
      return cookies;
    }, {});
}

function getWalletSessionTokenFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return (
    req.headers["x-veloxpay-session"]
    || req.body?.walletSessionToken
    || req.query?.walletSessionToken
    || cookies.veloxpay_wallet_session
    || ""
  );
}

function requireWalletSession(req, email) {
  if (!REQUIRE_WALLET_SESSION) {
    return null;
  }

  const session = readWalletSessionToken(getWalletSessionTokenFromRequest(req));
  const normalizedEmail = normalizeEmail(email);

  if (!session || session.email !== normalizedEmail) {
    const error = new Error("Wallet session expired. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }

  return session;
}

async function resolveOwnerIdentity(store, { email, displayName } = {}) {
  const ownerEmail = normalizeEmail(email) || normalizeEmail(DEFAULT_OWNER_EMAIL);
  const ownerDisplayName = String(displayName || "").trim();

  return ensureUserRecord(store, {
    email: ownerEmail,
    displayName: ownerDisplayName || displayNameFromEmail(ownerEmail)
  });
}

async function fetchTokenBalance(address, token) {
  const tokenConfig = getTokenConfig(token);
  const tokenContract = getTokenContract(tokenConfig.symbol);
  const rawBalance = await tokenContract.balanceOf(address);
  const decimals = tokenConfig.decimals ?? await tokenContract.decimals();

  return {
    symbol: tokenConfig.symbol,
    address: tokenConfig.address,
    balance: ethers.formatUnits(rawBalance, decimals)
  };
}

async function fetchAllTokenBalances(address) {
  const results = await Promise.allSettled(
    Object.keys(TOKENS).map(async (token) => [token, await fetchTokenBalance(address, token)])
  );
  const balances = {};
  const warnings = {};

  results.forEach((result, index) => {
    const token = Object.keys(TOKENS)[index];

    if (result.status === "fulfilled") {
      const [symbol, balance] = result.value;
      balances[symbol] = balance;
      return;
    }

    warnings[token] = sanitizePublicError(result.reason);
    balances[token] = {
      symbol: token,
      address: TOKENS[token].address,
      balance: "0",
      unavailable: true,
      warning: warnings[token]
    };
  });

  return { balances, warnings };
}

async function simulateTokenTransfer({ from, to, amount, token, memo }) {
  const tokenConfig = getTokenConfig(token);

  if (!tokenConfig) {
    throw new Error(buildTokenError());
  }

  if (!ethers.isAddress(from) || !ethers.isAddress(to)) {
    throw new Error("Valid from and recipient addresses are required");
  }

  assertPositiveAmount(amount);

  const tokenContract = getTokenContract(tokenConfig.symbol);
  const [rawTokenBalance, nativeBalance, feeData] = await Promise.all([
    tokenContract.balanceOf(from),
    provider.getBalance(from),
    provider.getFeeData()
  ]);
  const decimals = tokenConfig.decimals ?? await tokenContract.decimals();
  const value = ethers.parseUnits(String(amount || "0"), decimals);
  const gasLimit = String(memo || "").trim() ? BigInt(240000) : BigInt(100000);
  const gasPrice = feeData.gasPrice || BigInt(0);
  const estimatedNetworkFee = gasLimit * gasPrice;

  return {
    status: rawTokenBalance >= value && nativeBalance >= estimatedNetworkFee ? "ready" : "blocked",
    token: tokenConfig.symbol,
    amount: String(amount || "0"),
    from,
    to,
    hasEnoughToken: rawTokenBalance >= value,
    hasEnoughGas: nativeBalance >= estimatedNetworkFee,
    balance: ethers.formatUnits(rawTokenBalance, decimals),
    estimatedGasLimit: gasLimit.toString(),
    estimatedGasPrice: gasPrice.toString(),
    estimatedNetworkFee: ethers.formatUnits(estimatedNetworkFee, 18),
    gasToken: "USDC",
    finality: "single Arc confirmation is final"
  };
}

async function executeTokenTransfer({ to, amount, email, token, memo, memoReference, memoKind = "transfer", memoExtra = {} }) {
  const tokenConfig = getTokenConfig(token);

  if (!tokenConfig) {
    throw new Error(buildTokenError());
  }

  if (!to || !amount || !email) {
    throw new Error("Missing required fields: to, amount, email, token");
  }

  assertPositiveAmount(amount);
  const memoPayload = memo || memoReference || memoKind !== "transfer"
    ? buildMemoPayload({
        kind: memoKind,
        reference: memoReference,
        note: memo,
        extra: {
          token: tokenConfig.symbol,
          amount: String(amount),
          to,
          ...memoExtra
        }
      })
    : null;

  const store = readStore();
  const user = await getStoredUser(store, email) || { email };

  const { signer } = walletFromEmail(email);
  const signerAddress = user.walletAddress || (await signer.getAddress());

  if (!ethers.isAddress(to)) {
    throw new Error("Invalid recipient address");
  }

  // If Circle developer-controlled wallets are enabled and the user has a Circle wallet,
  // route the transfer through Circle's wallets API which handles gas and signing.
  if (ENABLE_CIRCLE_WALLETS && user && user.walletAddress) {
    return executeCircleTokenTransfer(user, to, amount, tokenConfig, memoPayload);
  }

  // Fallback: local signer using ethers (existing behavior)
  const tokenContract = getTokenContract(tokenConfig.symbol, signer);
  const [rawTokenBalance, nativeBalance, feeData] = await Promise.all([
    tokenContract.balanceOf(signerAddress),
    provider.getBalance(signerAddress),
    provider.getFeeData()
  ]);
  const decimals = tokenConfig.decimals ?? await tokenContract.decimals();

  const value = ethers.parseUnits(String(amount), decimals);

  if (rawTokenBalance < value) {
    throw new Error(
      `Insufficient ${tokenConfig.symbol}. Have ${ethers.formatUnits(rawTokenBalance, decimals)} ${tokenConfig.symbol}, need ${ethers.formatUnits(value, decimals)} ${tokenConfig.symbol}.`
    );
  }

  const gasLimit = BigInt(100000);
  const overrides = { gasLimit };

  if (feeData.gasPrice != null) {
    overrides.gasPrice = feeData.gasPrice;
  }

  const estimatedGasCost = gasLimit * (overrides.gasPrice || BigInt(0));

  if (nativeBalance < estimatedGasCost) {
    throw new Error(
      `Insufficient USDC for Arc network fees. Have ${ethers.formatUnits(nativeBalance, 18)} USDC available for gas, need about ${ethers.formatUnits(estimatedGasCost, 18)} USDC.`
    );
  }

  console.log(`Sending ${amount} ${tokenConfig.symbol} from ${signerAddress} to ${to}`);

  let tx;
  let memoMode = "none";

  if (memoPayload) {
    const memoContract = getMemoContract(signer);
    const memoCode = await provider.getCode(ARC_MEMO_ADDRESS);

    if (memoCode === "0x") {
      throw new Error("Arc Memo contract is not available on this RPC endpoint.");
    }

    const transferData = tokenContract.interface.encodeFunctionData("transfer", [to, value]);
    tx = await memoContract.memo(
      tokenConfig.address,
      transferData,
      memoPayload.id,
      ethers.toUtf8Bytes(memoPayload.text),
      overrides
    );
    memoMode = "arc-memo";
  } else {
    tx = await tokenContract.transfer(to, value, overrides);
  }

  const receipt = await waitForTransactionReceiptWithBackoff(tx.hash);
  const transactionHash = receipt?.hash || receipt?.transactionHash || tx.hash;

  console.log(`Transaction sent: ${transactionHash}`);

  return {
    status: "ok",
    settlementState: "final",
    settlementNetwork: "Arc Testnet",
    hash: transactionHash,
    from: signerAddress,
    to,
    amount,
    token: tokenConfig.symbol,
    symbol: tokenConfig.symbol,
    memo: memoPayload?.text || "",
    memoId: memoPayload?.id || "",
    memoReference: memoPayload?.reference || "",
    memoMode,
    explorer: buildExplorerUrl(transactionHash)
  };
}

async function executeNativeBatchTransfers({ email, transfers }) {
  const store = readStore();
  const user = await getStoredUser(store, email) || { email };

  if (user.walletAddress) {
    return null;
  }

  const { signer } = walletFromEmail(email);
  const from = await signer.getAddress();
  const multicallCode = await provider.getCode(ARC_MULTICALL3_FROM_ADDRESS);
  const memoCode = await provider.getCode(ARC_MEMO_ADDRESS);

  if (multicallCode === "0x" || memoCode === "0x") {
    throw new Error("Arc batch transaction contracts are not available on this RPC endpoint.");
  }

  const tokenState = new Map();
  const calls = [];
  const preparedTransfers = [];

  for (const [index, entry] of transfers.entries()) {
    const tokenConfig = getTokenConfig(entry.token || "USDC");

    if (!tokenConfig) {
      throw new Error(buildTokenError());
    }

    if (!tokenState.has(tokenConfig.symbol)) {
      const tokenContract = getTokenContract(tokenConfig.symbol, provider);
      const balance = await tokenContract.balanceOf(from);
      tokenState.set(tokenConfig.symbol, {
        tokenConfig,
        decimals: tokenConfig.decimals ?? await tokenContract.decimals(),
        balance,
        required: BigInt(0),
        contract: tokenContract
      });
    }

    const state = tokenState.get(tokenConfig.symbol);
    const value = ethers.parseUnits(String(entry.amount), state.decimals);
    state.required += value;

    const memoPayload = buildMemoPayload({
      kind: "batch-payout",
      reference: entry.memoReference || `veloxpay-batch:${crypto.randomUUID()}:${index + 1}`,
      note: entry.memo || `Batch payout ${index + 1}`,
      extra: {
        batchIndex: index + 1,
        token: tokenConfig.symbol,
        amount: String(entry.amount),
        to: entry.to
      }
    });
    const transferData = state.contract.interface.encodeFunctionData("transfer", [entry.to, value]);
    const memoData = getMemoContract(provider).interface.encodeFunctionData("memo", [
      tokenConfig.address,
      transferData,
      memoPayload.id,
      ethers.toUtf8Bytes(memoPayload.text)
    ]);

    calls.push({
      target: ARC_MEMO_ADDRESS,
      allowFailure: false,
      callData: memoData
    });
    preparedTransfers.push({
      from,
      to: entry.to,
      amount: String(entry.amount),
      token: tokenConfig.symbol,
      symbol: tokenConfig.symbol,
      memo: memoPayload.text,
      memoId: memoPayload.id,
      memoReference: memoPayload.reference,
      memoMode: "arc-memo-batch"
    });
  }

  for (const state of tokenState.values()) {
    if (state.balance < state.required) {
      throw new Error(
        `Insufficient ${state.tokenConfig.symbol}. Have ${ethers.formatUnits(state.balance, state.decimals)} ${state.tokenConfig.symbol}, need ${ethers.formatUnits(state.required, state.decimals)} ${state.tokenConfig.symbol}.`
      );
    }
  }

  const feeData = await provider.getFeeData();
  const gasLimit = BigInt(180000 + calls.length * 140000);
  const overrides = { gasLimit };

  if (feeData.gasPrice != null) {
    overrides.gasPrice = feeData.gasPrice;
  }

  const multicall = getMulticall3FromContract(signer);
  const tx = await multicall.aggregate3(calls, overrides);
  const receipt = await waitForTransactionReceiptWithBackoff(tx.hash);

  if (receipt?.status === 0) {
    throw new Error(`Arc batch transaction reverted: ${tx.hash}`);
  }

  const transactionHash = receipt?.hash || receipt?.transactionHash || tx.hash;

  return preparedTransfers.map((entry) => ({
    ...entry,
    status: "ok",
    settlementState: "final",
    settlementNetwork: "Arc Testnet",
    hash: transactionHash,
    batchMode: "arc-multicall3from",
    explorer: buildExplorerUrl(transactionHash)
  }));
}

function mapStoredPayment(payment) {
  return {
    id: payment.id,
    linkId: payment.linkId,
    linkLabel: payment.linkLabel,
    ownerEmail: payment.ownerEmail,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    transactionHash: payment.transactionHash,
    explorerUrl: payment.explorerUrl,
    memo: payment.memo || "",
    memoId: payment.memoId || "",
    memoReference: payment.memoReference || "",
    memoMode: payment.memoMode || "none",
    paidAt: payment.paidAt,
    payerEmail: payment.payerEmail,
    customerName: payment.customerName || "",
    receiptUrl: payment.receiptUrl || buildReceiptUrl(payment.id, payment.ownerEmail),
    timeline: Array.isArray(payment.timeline) ? payment.timeline : []
  };
}

function mapStoredCustomer(customer) {
  return {
    email: normalizeEmail(customer.email),
    name: String(customer.name || "").trim(),
    lastPaidAt: customer.lastPaidAt || customer.updatedAt || customer.createdAt || ""
  };
}

function mergeUniqueByKey(primaryItems, secondaryItems, buildKey) {
  const seen = new Set();
  const merged = [];

  for (const item of [...primaryItems, ...secondaryItems]) {
    if (!item) {
      continue;
    }

    const key = buildKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(item);
  }

  return merged;
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Arc Wallet Backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Arc Wallet Backend is running" });
});

app.get("/features", (req, res) => {
  res.json(buildFeatureCapabilities());
});

app.get("/readiness", (req, res) => {
  const report = buildReadinessReport();
  res.status(report.status === "ready" ? 200 : 503).json(report);
});

app.get("/arc/fee-quote", async (req, res) => {
  try {
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const gasLimit = BigInt(req.query.gasLimit || 100000);
    const estimatedNetworkFee = gasLimit * gasPrice;

    res.json({
      network: "Arc Testnet",
      gasToken: "USDC",
      gasPrice: gasPrice.toString(),
      gasLimit: gasLimit.toString(),
      estimatedNetworkFee: ethers.formatUnits(estimatedNetworkFee, 18),
      finality: "deterministic-sub-second"
    });
  } catch (err) {
    console.error("Fee quote error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/webhooks/circle/status", (req, res) => {
  res.json({
    status: "ok",
    webhookVerification: ENABLE_CIRCLE_WEBHOOK_VERIFICATION,
    circleApiUrl: CIRCLE_API_URL,
    requiredHeaders: ["X-Circle-Signature", "X-Circle-Key-Id"],
    note: ENABLE_CIRCLE_WEBHOOK_VERIFICATION
      ? "Signature verification is enabled."
      : "Signature verification is disabled. Set CIRCLE_API_KEY to enable it."
  });
});

app.post("/auth/send-code", async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const normalizedEmail = normalizeEmail(email);
    enforceRateLimit(`wallet-login:${normalizedEmail}:${req.ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_CODE_TTL_MINUTES * 60 * 1000).toISOString();
    const challengeId = buildWalletLoginChallengeToken({
      email: normalizedEmail,
      displayName,
      codeHash: hashOtpCode(code),
      expiresAt
    });

    await sendWalletLoginCodeEmail({
      to: normalizedEmail,
      code,
      displayName: String(displayName || "").trim()
    });

    res.json({
      challengeId,
      email: normalizedEmail,
      message: `We sent a verification code to ${normalizedEmail}.`
    });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/auth/verify-code", async (req, res) => {
  try {
    const { email, displayName, verificationCode, challengeId } = req.body;

    if (!email || !verificationCode || !challengeId) {
      return res.status(400).json({ error: "Email, verification code, and challenge ID are required" });
    }

    const challenge = readWalletLoginChallengeToken(challengeId);

    if (!challenge) {
      return res.status(400).json({ error: "Verification session expired. Please request a new code." });
    }

    const normalizedEmail = normalizeEmail(email);

    if (challenge.email !== normalizedEmail) {
      return res.status(400).json({ error: "Verification email does not match the active session." });
    }

    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: "Verification code expired. Please request a new code." });
    }

    if (challenge.codeHash !== hashOtpCode(verificationCode)) {
      return res.status(400).json({ error: "Incorrect verification code." });
    }

    const store = readStore();
    const user = await ensureUserRecord(store, {
      email: normalizedEmail,
      displayName: String(displayName || challenge.displayName || "").trim()
    });
    const balanceResult = await fetchAllTokenBalances(user.address);
    writeStore(store);

    res.json({
      ...mapStoredUser(user, { includeSession: true }),
      balances: balanceResult.balances,
      balanceWarnings: balanceResult.warnings,
      network: "arc-testnet"
    });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  res.status(400).json({ error: "Use email verification first. Start with /auth/send-code." });
});

app.get("/users/profile", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const store = readStore();
    const user = await getStoredUser(store, email);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(mapStoredUser(user));
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/users/profile", async (req, res) => {
  try {
    const { email, displayName } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    requireWalletSession(req, email);
    const store = readStore();
    const user = await ensureUserRecord(store, { email, displayName });
    writeStore(store);

    res.json(mapStoredUser(user));
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/balance", async (req, res) => {
  try {
    const { address, token } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    const tokenBalance = await fetchTokenBalance(address, token || "USDC");
    res.json({ ...tokenBalance, address });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/balances", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    const balanceResult = await fetchAllTokenBalances(address);
    res.json({ address, balances: balanceResult.balances, warnings: balanceResult.warnings });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/txs", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    const store = readStore();
    const storedTxs = store.txs.filter((tx) => tx.from === address || tx.to === address);
    let onchainTxs = [];

    try {
      onchainTxs = await fetchTokenTransferHistory(address, { direction: "all" });
    } catch (historyError) {
      console.warn("Token history fallback to stored txs:", historyError.message);
    }

    const txs = mergeUniqueByKey(
      storedTxs,
      onchainTxs,
      (tx) => `${tx.hash || tx.transactionHash}-${tx.symbol || tx.token || "ARC"}`
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ txs, address });
  } catch (err) {
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/send-transaction", async (req, res) => {
  try {
    requireWalletSession(req, req.body?.email);
    const transfer = await executeTokenTransfer(req.body);
    const store = readStore();

    store.txs.unshift({
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      symbol: transfer.symbol,
      token: transfer.token,
      memo: transfer.memo || "",
      memoId: transfer.memoId || "",
      memoReference: transfer.memoReference || "",
      memoMode: transfer.memoMode || "none",
      status: "confirmed",
      explorer: transfer.explorer,
      timestamp: new Date().toISOString()
    });

    writeStore(store);
    res.json(transfer);
  } catch (err) {
    console.error("Send transaction error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/transactions/simulate", async (req, res) => {
  try {
    const { to, amount, email, token, memo } = req.body || {};
    requireWalletSession(req, email);
    const store = readStore();
    const user = await getStoredUser(store, email);
    const { signer } = walletFromEmail(email);
    const from = user?.walletAddress || user?.address || await signer.getAddress();
    const simulation = await simulateTokenTransfer({ from, to, amount, token, memo });

    res.json(simulation);
  } catch (err) {
    console.error("Transaction simulation error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/batch-transfers", async (req, res) => {
  try {
    const { email, transfers } = req.body || {};

    if (!email || !Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({ error: "Email and at least one transfer are required" });
    }

    requireWalletSession(req, email);

    if (transfers.length > 25) {
      return res.status(400).json({ error: "Batch transfers are limited to 25 recipients for now" });
    }

    transfers.forEach((entry, index) => {
      if (!ethers.isAddress(entry.to)) {
        throw new Error(`Transfer ${index + 1} has an invalid recipient address`);
      }

      assertPositiveAmount(entry.amount, `Transfer ${index + 1} amount`);
    });

    const store = readStore();
    const nativeBatchResults = await executeNativeBatchTransfers({ email, transfers });

    if (nativeBatchResults) {
      nativeBatchResults.forEach((transfer) => {
        store.txs.unshift({
          hash: transfer.hash,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          symbol: transfer.symbol,
          token: transfer.token,
          memo: transfer.memo || "",
          memoId: transfer.memoId || "",
          memoReference: transfer.memoReference || "",
          memoMode: transfer.memoMode || "none",
          batchMode: transfer.batchMode || "arc-multicall3from",
          status: "confirmed",
          explorer: transfer.explorer,
          timestamp: new Date().toISOString(),
          batch: true
        });
      });

      writeStore(store);
      return res.json({
        status: "completed",
        count: nativeBatchResults.length,
        batchMode: "arc-multicall3from",
        hash: nativeBatchResults[0]?.hash || "",
        settlementNetwork: "Arc Testnet",
        settlementState: "final",
        message: "Batch payout completed as one Arc Multicall3From transaction with per-transfer memos.",
        results: nativeBatchResults
      });
    }

    const results = [];

    for (const [index, entry] of transfers.entries()) {
      const transfer = await executeTokenTransfer({
        email,
        to: entry.to,
        amount: entry.amount,
        token: entry.token || "USDC",
        memo: entry.memo || `Batch payout ${index + 1}`,
        memoReference: entry.memoReference || `veloxpay-batch:${crypto.randomUUID()}:${index + 1}`,
        memoKind: "batch-payout",
        memoExtra: { batchIndex: index + 1 }
      });

      store.txs.unshift({
        hash: transfer.hash,
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount,
      symbol: transfer.symbol,
      token: transfer.token,
      memo: transfer.memo || "",
      memoId: transfer.memoId || "",
      memoReference: transfer.memoReference || "",
      memoMode: transfer.memoMode || "none",
      status: "confirmed",
      explorer: transfer.explorer,
      timestamp: new Date().toISOString(),
        batch: true
      });
      results.push(transfer);
    }

    writeStore(store);
    res.json({
      status: "completed",
      count: results.length,
      batchMode: "circle-compatible-sequential",
      settlementNetwork: "Arc Testnet",
      settlementState: "final",
      message: "Batch payout completed through Circle wallet transfers. Arc-native Multicall3From is used only for local EOA wallets because Arc requires EOA submission for native batches.",
      results
    });
  } catch (err) {
    console.error("Batch transfer error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/create-wallet", async (req, res) => {
  try {
    if (!ENABLE_CIRCLE_WALLETS) {
      return res.status(400).json({ error: "Circle wallets not configured" });
    }

    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    requireWalletSession(req, email);
    const store = readStore();
    const user = await ensureUserRecord(store, { email });

    if (user.walletAddress) {
      return res.json(mapStoredUser(user));
    }

    const wallet = await createCircleWallet(store);
    user.walletAddress = wallet.walletAddress;
    user.walletId = wallet.walletId;
    user.walletSetId = wallet.walletSetId;
    user.blockchain = wallet.blockchain;
    user.address = wallet.walletAddress;
    store.users[normalizeEmail(email)] = user;
    writeStore(store);

    res.json(mapStoredUser(user));
  } catch (err) {
    console.error("Create wallet error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/wallet/custody-options", (req, res) => {
  res.json({
    default: ENABLE_CIRCLE_WALLETS ? "developer-controlled" : "local-demo",
    options: [
      {
        id: "developer-controlled",
        label: "Circle Developer-Controlled Wallet",
        enabled: ENABLE_CIRCLE_WALLETS,
        bestFor: "Invisible wallet UX, payment links, automated payouts, and merchant flows.",
        custody: "Application-managed with Circle Wallets infrastructure.",
        gasMode: ENABLE_CIRCLE_GAS_STATION ? "Circle Gas Station sponsored gas" : "Arc USDC-native gas"
      },
      {
        id: "user-controlled",
        label: "Circle User-Controlled Wallet",
        enabled: ENABLE_USER_CONTROLLED_WALLETS,
        bestFor: "Users who want direct approval, social/email wallet auth, and stronger self-custody semantics.",
        custody: "User-controlled through Circle SDK configuration.",
        setupRequired: ENABLE_USER_CONTROLLED_WALLETS ? "" : "Set CIRCLE_USER_CONTROLLED_APP_ID and add the Circle user-controlled wallet SDK flow."
      }
    ]
  });
});

app.post("/wallets/user-controlled/session", (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  requireWalletSession(req, email);

  if (!ENABLE_USER_CONTROLLED_WALLETS) {
    return res.status(202).json(buildUnavailableFeature(
      "Circle User-Controlled Wallets",
      "CIRCLE_USER_CONTROLLED_APP_ID and the Circle Web SDK client flow"
    ));
  }

  res.json({
    status: "ready",
    appId: process.env.CIRCLE_USER_CONTROLLED_APP_ID,
    userId: crypto.createHash("sha256").update(email).digest("hex"),
    email,
    nextStep: "Initialize the Circle user-controlled wallet SDK on the client with this app ID and user ID."
  });
});

// Circle webhook receiver for real-time transaction updates
app.post("/webhooks/circle", async (req, res) => {
  try {
    if (ENABLE_CIRCLE_WEBHOOK_VERIFICATION) {
      await verifyCircleWebhookSignature(req);
    }

    const payload = req.body || {};
    const store = readStore();

    const tx = payload?.data?.transaction || payload?.data || payload;
    const txHash = tx?.txHash || tx?.transactionHash || tx?.tx_hash || tx?.hash || tx?.id || null;
    const state = tx?.state || payload?.type || "updated";

    if (txHash) {
      const idx = store.txs.findIndex((t) => t.hash === txHash || t.hash === tx?.id);
      if (idx >= 0) {
        store.txs[idx].status = state;
        store.txs[idx].rawWebhook = payload;
        writeStore(store);
      }
    }

    console.log("Circle webhook received:", payload?.type || txHash || "(no-id)");
    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/payment-links", async (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);
    const store = readStore();
    const mergedLinks = mergeUniqueByKey(
      ownerEmail ? await listPersistentPaymentLinks(ownerEmail) : [],
      store.paymentLinks,
      (link) => link.linkCode || link.id
    );
    const paymentLinks = [...mergedLinks]
      .filter((link) => !ownerEmail || link.ownerEmail === ownerEmail)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((link) => ({
        ...hydratePaymentLinkAccess(link),
        url: buildPaymentLinkUrl(link)
      }));

    res.json(paymentLinks);
  } catch (err) {
    console.error("List payment links error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/payment-links/resolve", async (req, res) => {
  try {
    const username = slugifySegment(req.query.username);
    const amount = String(req.query.amount || "").trim();
    const linkId = String(req.query.linkId || "").trim();
    const linkToken = String(req.query.k || req.query.linkToken || "").trim();

    if (!linkId && !linkToken && (!username || !amount)) {
      return res.status(400).json({ error: "Link ID or username and amount are required" });
    }

    const store = readStore();
    const paymentLink = await resolvePaymentLink(store, { username, amount, linkId, linkToken });

    if (!paymentLink) {
      return res.status(404).json({ error: "Payment link not found" });
    }

    if (paymentLink.linkCode) {
      setTimelineEventOnce(paymentLink, "opened", "Opened by payer");
      paymentLink.openedCount = Number(paymentLink.openedCount || 0) + 1;
      await syncStoredPaymentLink(store, paymentLink);
      writeStore(store);
    }

    hydratePaymentLinkAccess(paymentLink);
    paymentLink.url = buildPaymentLinkUrl(paymentLink);
    res.json(paymentLink);
  } catch (err) {
    console.error("Resolve payment link error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/payment-links", async (req, res) => {
  try {
    const { amount, description, currency, ownerEmail, ownerName, recurrence, customerEmail, customerName } = req.body;
    const normalizedCurrency = normalizeToken(currency || DEFAULT_LINK_CURRENCY);
    const tokenConfig = getTokenConfig(normalizedCurrency);

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    if (!tokenConfig) {
      return res.status(400).json({ error: buildTokenError() });
    }

    requireWalletSession(req, ownerEmail);

    const store = readStore();
    const owner = await resolveOwnerIdentity(store, { email: ownerEmail, displayName: ownerName });
    const id = crypto.randomUUID();
    const normalizedAmount = normalizeAmount(amount);
    const createdAt = new Date().toISOString();
    const paymentLink = {
      id,
      username: owner.username || DEFAULT_OWNER_USERNAME,
      ownerName: owner.displayName,
      ownerEmail: owner.email,
      recipientAddress: owner.address,
      amount: normalizedAmount,
      description: description?.trim() || "",
      currency: tokenConfig.symbol,
      recurrence: buildRecurrence(recurrence, createdAt),
      customerEmail: normalizeEmail(customerEmail || ""),
      customerName: String(customerName || "").trim(),
      status: "active",
      createdAt,
      timeline: [createTimelineEvent("sent", "Payment request created")]
    };

    paymentLink.linkCode = generateShortPaymentLinkCode({
      username: paymentLink.username,
      amount: paymentLink.amount,
      currency: paymentLink.currency
    });
    paymentLink.linkToken = buildPaymentLinkToken(paymentLink);
    paymentLink.url = buildPaymentLinkUrl(paymentLink);
    await syncStoredPaymentLink(store, paymentLink);
    if (paymentLink.customerEmail) {
      const nextCustomers = rememberCustomer(store, paymentLink.ownerEmail, {
        email: paymentLink.customerEmail,
        name: paymentLink.customerName || "",
        lastPaidAt: paymentLink.createdAt
      });
      await savePersistentCustomers(paymentLink.ownerEmail, nextCustomers);
    }
    writeStore(store);

    res.status(201).json(paymentLink);
  } catch (err) {
    console.error("Create payment link error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/payment-links/recurring", async (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);

    if (ownerEmail) {
      requireWalletSession(req, ownerEmail);
    }

    const store = readStore();
    const links = mergeUniqueByKey(
      ownerEmail ? await listPersistentPaymentLinks(ownerEmail) : [],
      store.paymentLinks,
      (link) => link.linkCode || link.id
    )
      .filter((link) => !ownerEmail || link.ownerEmail === ownerEmail)
      .filter((link) => link.recurrence?.interval && link.recurrence.interval !== "one-time")
      .map((link) => {
        hydratePaymentLinkAccess(link);
        return {
          ...link,
          url: buildPaymentLinkUrl(link),
          nextDueAt: link.recurrence?.nextDueAt || ""
        };
      });

    res.json(links);
  } catch (err) {
    console.error("Recurring links error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/payments", async (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);
    const payerEmail = normalizeEmail(req.query.payerEmail);
    const store = readStore();

    if (payerEmail && !ownerEmail) {
      const storedOutgoingPayments = mergeUniqueByKey(
        await listPersistentPayerPayments(payerEmail),
        store.payments.filter((payment) => payment.payerEmail === payerEmail),
        (payment) => payment.id
      )
        .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
        .map((payment) => ({
          ...mapStoredPayment(payment),
          direction: "outgoing"
        }));

      const payer = await getStoredUser(store, payerEmail);
      const { signer } = walletFromEmail(payerEmail);
      const payerAddress = payer?.walletAddress || payer?.address || signer.address;
      let onchainOutgoing = [];

      try {
        onchainOutgoing = (await fetchTokenTransferHistory(payerAddress, { direction: "outgoing" }))
          .map((tx) => ({
            id: tx.id,
            linkId: tx.hash,
            linkLabel: "Outgoing transfer",
            amount: tx.amount,
            currency: tx.currency,
            status: "completed",
            transactionHash: tx.hash,
            explorerUrl: tx.explorerUrl,
            paidAt: tx.paidAt,
            payerEmail,
            direction: "outgoing"
          }));
      } catch (paymentHistoryError) {
        console.warn("Outgoing payments fallback to stored records:", paymentHistoryError.message);
      }

      const outgoingPayments = mergeUniqueByKey(
        storedOutgoingPayments,
        onchainOutgoing,
        (payment) => payment.transactionHash || payment.id
      ).sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

      return res.json(outgoingPayments);
    }

    const storedPayments = mergeUniqueByKey(
      ownerEmail ? await listPersistentPayments(ownerEmail) : [],
      store.payments,
      (payment) => payment.id
    )
      .filter((payment) => !ownerEmail || payment.ownerEmail === ownerEmail)
      .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
      .map((payment) => ({
        ...mapStoredPayment(payment),
        direction: "incoming"
      }));

    if (!ownerEmail) {
      return res.json(storedPayments);
    }

    const owner = await getStoredUser(store, ownerEmail);
    const { signer } = walletFromEmail(ownerEmail);
    const ownerAddress = owner?.walletAddress || owner?.address || signer.address;
    let onchainIncoming = [];

    try {
      onchainIncoming = (await fetchTokenTransferHistory(ownerAddress, { direction: "incoming" }))
        .map((tx) => ({
          id: tx.id,
          linkId: tx.hash,
          linkLabel: "Incoming transfer",
          amount: tx.amount,
          currency: tx.currency,
          status: "completed",
          transactionHash: tx.hash,
          explorerUrl: tx.explorerUrl,
          paidAt: tx.paidAt,
          direction: "incoming"
        }));
    } catch (paymentHistoryError) {
      console.warn("Payments fallback to stored records:", paymentHistoryError.message);
    }

    const payments = mergeUniqueByKey(
      storedPayments,
      onchainIncoming,
      (payment) => payment.transactionHash || payment.id
    ).sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

    res.json(payments);
  } catch (err) {
    console.error("List payments error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/payments/:paymentId", async (req, res, next) => {
  try {
    const paymentId = String(req.params.paymentId || "").trim();

    if (paymentId === "settlement-report") {
      return next();
    }

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID required" });
    }

    const store = readStore();
    const payment = store.payments.find((entry) => entry.id === paymentId)
      || await getPersistentPayment(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.json(mapStoredPayment(payment));
  } catch (err) {
    console.error("Get payment error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/customers", async (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);

    if (!ownerEmail) {
      return res.status(400).json({ error: "Owner email required" });
    }

    requireWalletSession(req, ownerEmail);
    const store = readStore();
    const localCustomers = (Array.isArray(store.customers) ? store.customers : [])
      .filter((customer) => normalizeEmail(customer.ownerEmail) === ownerEmail)
      .map(mapStoredCustomer);
    const persistentCustomers = (await listPersistentCustomers(ownerEmail)).map(mapStoredCustomer);

    const customers = mergeUniqueByKey(
      persistentCustomers,
      localCustomers,
      (customer) => customer.email
    ).sort((a, b) => new Date(b.lastPaidAt || 0).getTime() - new Date(a.lastPaidAt || 0).getTime());

    res.json(customers);
  } catch (err) {
    console.error("List customers error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.get("/unified-balance", async (req, res) => {
  try {
    const address = String(req.query.address || "").trim();

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    const arcBalanceResult = await fetchAllTokenBalances(address);
    const arcBalances = arcBalanceResult.balances;
    let appKitBalance = null;

    if (ENABLE_ARC_APP_KIT_EXECUTION && req.query.useAppKit === "true") {
      try {
        appKitBalance = await getUnifiedBalanceWithCircleWallets({
          apiKey: CIRCLE_API_KEY,
          entitySecret: CIRCLE_ENTITY_SECRET,
          baseUrl: CIRCLE_API_URL,
          chain: "Arc_Testnet",
          address,
          token: "USDC"
        });
      } catch (appKitError) {
        appKitBalance = {
          status: "app_kit_error",
          message: appKitError.message
        };
      }
    }

    res.json({
      status: appKitBalance ? "app_kit_checked" : ENABLE_ARC_APP_KIT ? "ready_for_app_kit" : "local_arc_only",
      address,
      totalConfirmedBalance: arcBalances.USDC?.balance || "0",
      token: "USDC",
      appKitBalance,
      sources: [
        {
          chain: "Arc Testnet",
          balance: arcBalances.USDC?.balance || "0",
          status: "confirmed"
        }
      ],
      message: ENABLE_ARC_APP_KIT
        ? "Arc App Kit can extend this into a chain-agnostic USDC balance across supported chains."
        : "Set ARC_APP_KIT_KEY or Circle App Kit configuration to enable cross-chain Unified Balance."
    });
  } catch (err) {
    console.error("Unified balance error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/bridge/quote", (req, res) => {
  const { fromChain = "Base Sepolia", toChain = "Arc Testnet", amount = "0", token = "USDC" } = req.body || {};

  if (normalizeToken(token) !== "USDC") {
    return res.status(400).json({ error: "Arc App Kit bridge currently supports USDC for this VeloxPay flow" });
  }

  res.json({
    status: ENABLE_ARC_APP_KIT ? "ready_for_app_kit" : "configuration_required",
    fromChain,
    toChain,
    amount: String(amount),
    token: "USDC",
    estimatedDuration: "seconds to minutes depending on route",
    route: `${fromChain} -> ${toChain}`,
    message: ENABLE_ARC_APP_KIT
      ? "Use Arc App Kit Bridge with the Circle Wallets adapter to execute this quote."
      : "Bridge quotes are not live on this deployment yet. Add the Circle wallet and Arc App Kit env vars to the backend deployment to enable them."
  });
});

app.post("/bridge", async (req, res) => {
  const {
    fromChain = "Base_Sepolia",
    toChain = "Arc_Testnet",
    fromAddress,
    toAddress,
    amount = "0",
    token = "USDC",
    execute = false
  } = req.body || {};

  if (!ENABLE_ARC_APP_KIT_EXECUTION) {
    return res.status(202).json(buildUnavailableFeature("Arc App Kit Bridge", "ARC_APP_KIT_KEY, CIRCLE_API_KEY, and CIRCLE_ENTITY_SECRET"));
  }

  if (normalizeToken(token) !== "USDC") {
    return res.status(400).json({ error: "Arc App Kit bridge currently supports USDC for this VeloxPay flow" });
  }

  if (!execute) {
    return res.status(202).json({
      status: "ready_for_execution",
      fromChain,
      toChain,
      amount: String(amount),
      token: "USDC",
      nextStep: "Send execute=true with source and destination Circle wallet addresses when you are ready to run the bridge."
    });
  }

  if (!fromAddress || !toAddress) {
    return res.status(400).json({ error: "fromAddress and toAddress are required for bridge execution" });
  }

  assertPositiveAmount(amount);

  try {
    const result = await executeBridgeWithCircleWallets({
      apiKey: CIRCLE_API_KEY,
      entitySecret: CIRCLE_ENTITY_SECRET,
      baseUrl: CIRCLE_API_URL,
      fromChain,
      toChain,
      fromAddress,
      toAddress,
      amount: String(amount)
    });

    return res.json({
      status: "submitted",
      feature: "Arc App Kit Bridge",
      result
    });
  } catch (err) {
    console.error("Bridge execution error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/bridge/prepare", (req, res) => {
  const { fromChain = "Base_Sepolia", toChain = "Arc_Testnet", amount = "0", token = "USDC" } = req.body || {};

  res.status(202).json({
    status: "ready_for_execution",
    fromChain,
    toChain,
    amount: String(amount),
    token: normalizeToken(token),
    nextStep: "Execute with AppKit.bridge using the Circle Wallets adapter for the selected wallets."
  });
});

app.post("/swaps/quote", (req, res) => {
  const { fromToken = "EURC", toToken = "USDC", amount = "0", chain = "Arc Testnet" } = req.body || {};
  const source = normalizeToken(fromToken);
  const destination = normalizeToken(toToken);

  if (!getTokenConfig(source) || !getTokenConfig(destination)) {
    return res.status(400).json({ error: buildTokenError() });
  }

  res.json({
    status: ENABLE_ARC_APP_KIT ? "ready_for_app_kit" : "configuration_required",
    chain,
    fromToken: source,
    toToken: destination,
    amount: String(amount),
    message: ENABLE_ARC_APP_KIT
      ? "Use Arc App Kit Swap to fetch a live executable quote."
      : "Swap quotes are not live on this deployment yet. Add the Circle wallet and Arc App Kit env vars to the backend deployment to enable them."
  });
});

app.post("/swaps", (req, res) => {
  if (!ENABLE_ARC_APP_KIT_EXECUTION) {
    return res.status(202).json(buildUnavailableFeature("Arc App Kit Swap", "ARC_APP_KIT_KEY, CIRCLE_API_KEY, and CIRCLE_ENTITY_SECRET"));
  }

  const {
    chain = "Arc_Testnet",
    address,
    fromToken = "EURC",
    toToken = "USDC",
    amount = "0",
    execute = false
  } = req.body || {};

  if (!execute) {
    return res.status(202).json({
      status: "ready_for_execution",
      request: req.body || {},
      nextStep: "Send execute=true with the Circle wallet address when you are ready to run the swap."
    });
  }

  if (!address) {
    return res.status(400).json({ error: "Circle wallet address is required for swap execution" });
  }

  assertPositiveAmount(amount);

  executeSwapWithCircleWallets({
    apiKey: CIRCLE_API_KEY,
    entitySecret: CIRCLE_ENTITY_SECRET,
    baseUrl: CIRCLE_API_URL,
    kitKey: ARC_APP_KIT_KEY,
    chain,
    address,
    tokenIn: normalizeToken(fromToken),
    tokenOut: normalizeToken(toToken),
    amountIn: String(amount)
  })
    .then((result) => res.json({ status: "submitted", feature: "Arc App Kit Swap", result }))
    .catch((err) => {
      console.error("Swap execution error:", err);
      res.status(err.statusCode || 500).json({ error: err.message });
    });
});

app.get("/payments/settlement-report", async (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);

    if (ownerEmail) {
      requireWalletSession(req, ownerEmail);
    }

    const store = readStore();
    const payments = mergeUniqueByKey(
      ownerEmail ? await listPersistentPayments(ownerEmail) : [],
      store.payments,
      (payment) => payment.id
    ).filter((payment) => !ownerEmail || payment.ownerEmail === ownerEmail);
    const completed = payments.filter((payment) => payment.status === "completed");
    const totals = completed.reduce((acc, payment) => {
      const currency = normalizeToken(payment.currency);
      acc[currency] = (acc[currency] || 0) + Number(payment.amount || 0);
      return acc;
    }, {});

    res.json({
      ownerEmail,
      settlementNetwork: "Arc Testnet",
      finality: "deterministic-sub-second",
      completedPayments: completed.length,
      failedPayments: payments.filter((payment) => payment.status === "failed").length,
      totals,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Settlement report error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/payment-links/:linkId/send-code", async (req, res) => {
  try {
    const { linkId } = req.params;
    const payerEmail = normalizeEmail(req.body.payerEmail);
    const linkToken = String(req.body.linkToken || "").trim();
    const username = String(req.body.username || "").trim();
    const amount = String(req.body.amount || "").trim();
    const currency = String(req.body.currency || "").trim();
    const store = readStore();

    const paymentLink = await resolvePaymentLink(store, { linkId, linkToken, username, amount, currency });

    if (!paymentLink) {
      return res.status(404).json({ error: "Payment link not found" });
    }

    if (paymentLink.status !== "active") {
      return res.status(400).json({ error: "This payment link is not active" });
    }

    if (!payerEmail) {
      return res.status(400).json({ error: "Payer email is required" });
    }

    enforceRateLimit(`payment-code:${linkId}:${payerEmail}:${req.ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    hydratePaymentLinkAccess(paymentLink);
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_CODE_TTL_MINUTES * 60 * 1000).toISOString();
    const challengeId = buildPaymentChallengeToken({
      linkId,
      payerEmail,
      codeHash: hashOtpCode(code),
      expiresAt,
      linkToken: paymentLink.linkToken
    });

    appendTimelineEvent(paymentLink, "code_requested", "Verification code requested", `Sent to ${payerEmail}`);
    await syncStoredPaymentLink(store, paymentLink);
    writeStore(store);

    await sendVerificationCodeEmail({
      to: payerEmail,
      code,
      paymentLink
    });

    res.json({
      challengeId,
      linkToken: paymentLink.linkToken,
      payerEmail,
      message: `We sent a verification code to ${payerEmail}.`
    });
  } catch (err) {
    console.error("Send verification code error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post("/payment-links/:linkId/confirm-payment", async (req, res) => {
  const { linkId } = req.params;
  const payerEmail = normalizeEmail(req.body.payerEmail);
  const verificationCode = String(req.body.verificationCode || "").trim();
  const challengeId = String(req.body.challengeId || "").trim();
  const incomingLinkToken = String(req.body.linkToken || "").trim();
  const username = String(req.body.username || "").trim();
  const amount = String(req.body.amount || "").trim();
  const currency = String(req.body.currency || "").trim();
  const store = readStore();

  if (!payerEmail || !verificationCode || !challengeId) {
    return res.status(400).json({ error: "Email, verification code, and challenge ID are required" });
  }

  const challenge = readPaymentChallengeToken(challengeId);

  if (!challenge) {
    return res.status(400).json({ error: "Verification session expired. Please request a new code." });
  }

  const linkToken = incomingLinkToken || challenge.linkToken || "";
  const paymentLink = await resolvePaymentLink(store, { linkId, linkToken, username, amount, currency });

  if (!paymentLink) {
    return res.status(404).json({ error: "Payment link not found" });
  }

  if (paymentLink.status !== "active") {
    return res.status(400).json({ error: "This payment link is not active" });
  }

  if (challenge.linkId !== linkId) {
    return res.status(400).json({ error: "Verification session does not match this payment link." });
  }

  if (challenge.payerEmail !== payerEmail) {
    return res.status(400).json({ error: "Verification email does not match the active session." });
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ error: "Verification code expired. Please request a new code." });
  }

  if (challenge.codeHash !== hashOtpCode(verificationCode)) {
    return res.status(400).json({ error: "Incorrect verification code." });
  }

  const paymentId = crypto.randomUUID();

  try {
    const transfer = await executeTokenTransfer({
      to: paymentLink.recipientAddress,
      amount: paymentLink.amount,
      email: payerEmail,
      token: paymentLink.currency,
      memo: paymentLink.description || buildPaymentLinkLabel(paymentLink),
      memoReference: `veloxpay-payment:${paymentLink.id}:${paymentId}`,
      memoKind: "payment-link",
      memoExtra: {
        paymentId,
        linkId: paymentLink.id,
        ownerEmail: paymentLink.ownerEmail,
        payerEmail
      }
    });

    const payment = {
      id: paymentId,
      linkId: paymentLink.id,
      linkLabel: buildPaymentLinkLabel(paymentLink),
      ownerEmail: paymentLink.ownerEmail,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      status: "completed",
      payerEmail,
      customerName: paymentLink.customerName || "",
      recipientAddress: paymentLink.recipientAddress,
      transactionHash: transfer.hash,
      explorerUrl: transfer.explorer,
      memo: transfer.memo || "",
      memoId: transfer.memoId || "",
      memoReference: transfer.memoReference || "",
      memoMode: transfer.memoMode || "none",
      receiptUrl: buildReceiptUrl(paymentId, paymentLink.ownerEmail),
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      timeline: [
        createTimelineEvent("sent", "Payment request created"),
        createTimelineEvent("opened", "Payment page opened"),
        createTimelineEvent("code_requested", "Verification code requested", `Sent to ${payerEmail}`),
        createTimelineEvent("paid", "Payment completed", `${paymentLink.amount} ${paymentLink.currency}`)
      ]
    };

    appendTimelineEvent(paymentLink, "paid", "Payment completed", `${payment.amount} ${payment.currency}`);
    paymentLink.lastPaidAt = payment.paidAt;
    store.payments.unshift(payment);
    await savePersistentPayment(payment);
    await syncStoredPaymentLink(store, paymentLink);
    const nextCustomers = rememberCustomer(store, paymentLink.ownerEmail, {
      email: payerEmail,
      name: paymentLink.customerName || "",
      lastPaidAt: payment.paidAt
    });
    await savePersistentCustomers(paymentLink.ownerEmail, nextCustomers);
    store.txs.unshift({
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      symbol: transfer.symbol,
      token: transfer.token,
      memo: transfer.memo || "",
      memoId: transfer.memoId || "",
      memoReference: transfer.memoReference || "",
      memoMode: transfer.memoMode || "none",
      status: "confirmed",
      explorer: transfer.explorer,
      timestamp: payment.paidAt
    });
    writeStore(store);

    res.json(mapStoredPayment(payment));
  } catch (err) {
    const failedPayment = {
      id: paymentId,
      linkId: paymentLink.id,
      linkLabel: buildPaymentLinkLabel(paymentLink),
      ownerEmail: paymentLink.ownerEmail,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      status: "failed",
      payerEmail,
      customerName: paymentLink.customerName || "",
      recipientAddress: paymentLink.recipientAddress,
      error: err.message,
      createdAt: new Date().toISOString(),
      receiptUrl: buildReceiptUrl(paymentId, paymentLink.ownerEmail),
      timeline: [
        createTimelineEvent("sent", "Payment request created"),
        createTimelineEvent("opened", "Payment page opened"),
        createTimelineEvent("code_requested", "Verification code requested", `Sent to ${payerEmail}`),
        createTimelineEvent("failed", "Payment failed", err.message)
      ]
    };

    appendTimelineEvent(paymentLink, "failed", "Payment attempt failed", err.message);
    store.payments.unshift(failedPayment);
    await savePersistentPayment(failedPayment);
    await syncStoredPaymentLink(store, paymentLink);
    writeStore(store);

    console.error("Payment link confirm error:", err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(4000, () => console.log("Arc Wallet Backend Live on :4000"));
}

module.exports = app;
