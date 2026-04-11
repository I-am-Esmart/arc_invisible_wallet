const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const nodemailer = require("nodemailer");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 value) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const TOKENS = {
  USDC: {
    symbol: "USDC",
    address: "0x3600000000000000000000000000000000000000"
  },
  EURC: {
    symbol: "EURC",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"
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
const WALLET_APP_BASE_URL = (process.env.WALLET_APP_BASE_URL || "https://arc-wallet.vercel.app").replace(/\/$/, "");
const PAYMENT_LINK_SIGNING_SECRET = process.env.PAYMENT_LINK_SIGNING_SECRET || "veloxpay-demo-secret";
const OTP_CODE_TTL_MINUTES = Math.max(1, Number(process.env.OTP_CODE_TTL_MINUTES || 10));
const OTP_MAX_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS || 5));
const TRANSFER_HISTORY_LOOKBACK_BLOCKS = Math.max(2000, Number(process.env.TRANSFER_HISTORY_LOOKBACK_BLOCKS || 250000));
const RESEND_API_URL = "https://api.resend.com/emails";

function normalizeOrigin(origin) {
  return origin.replace(/\/$/, "");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeToken(token) {
  return (token || "USDC").toUpperCase();
}

function normalizeAmount(amount) {
  return Number(amount).toString();
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

function buildPaymentChallengeToken({ linkId, payerEmail, codeHash, expiresAt }) {
  const payload = encodeBase64Url(JSON.stringify({
    linkId,
    payerEmail,
    codeHash,
    expiresAt
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
    txs: [],
    paymentLinks: [],
    payments: [],
    paymentAuthSessions: []
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
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    paymentAuthSessions: Array.isArray(parsed.paymentAuthSessions) ? parsed.paymentAuthSessions : []
  };
}

function writeStore(store) {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function cleanExpiredPaymentSessions(store) {
  const now = Date.now();
  store.paymentAuthSessions = store.paymentAuthSessions.filter((session) => {
    return new Date(session.expiresAt).getTime() > now && !session.usedAt;
  });
}

function buildPaymentLinkPath(paymentLink) {
  if (paymentLink.linkCode) {
    return `/pay/${paymentLink.linkCode}`;
  }

  return `/${paymentLink.username}/${paymentLink.amount}`;
}

function buildPaymentLinkUrl(paymentLink) {
  return `${DEFAULT_LINK_BASE_URL}${buildPaymentLinkPath(paymentLink)}`;
}

function buildPaymentLinkLabel(paymentLink) {
  if (paymentLink.linkCode) {
    return `/pay/${paymentLink.linkCode}`;
  }

  return `/${paymentLink.username}/${paymentLink.amount}`;
}

function buildWalletCreateUrl(email, paymentLink) {
  const params = new URLSearchParams();
  params.set("email", normalizeEmail(email));
  params.set("source", "veloxpay");

  if (paymentLink) {
    params.set("returnTo", buildPaymentLinkUrl(paymentLink));
  }

  return `${WALLET_APP_BASE_URL}/?${params.toString()}`;
}

function buildUniqueUsername(store, baseUsername, currentEmail) {
  const fallbackUsername = slugifySegment(baseUsername) || slugifySegment(DEFAULT_OWNER_USERNAME) || "member";
  const taken = new Set(
    Object.values(store.users)
      .filter((user) => user.email !== currentEmail)
      .map((user) => user.username)
      .filter(Boolean)
  );

  if (!taken.has(fallbackUsername)) {
    return fallbackUsername;
  }

  let suffix = 2;
  while (taken.has(`${fallbackUsername}-${suffix}`)) {
    suffix += 1;
  }

  return `${fallbackUsername}-${suffix}`;
}

function ensureUserRecord(store, { email, displayName }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email required");
  }

  const existingUser = store.users[normalizedEmail];
  const nextDisplayName = String(displayName || existingUser?.displayName || displayNameFromEmail(normalizedEmail)).trim();
  const baseUsername = slugifySegment(nextDisplayName) || slugifySegment(normalizedEmail.split("@")[0]) || "member";

  if (existingUser) {
    if (!existingUser.username) {
      existingUser.username = buildUniqueUsername(store, baseUsername, normalizedEmail);
    }

    if (displayName) {
      existingUser.displayName = nextDisplayName;
    } else if (!existingUser.displayName) {
      existingUser.displayName = displayNameFromEmail(normalizedEmail);
    }

    existingUser.updatedAt = new Date().toISOString();
    return existingUser;
  }

  const { signer, arcKeyId } = walletFromEmail(normalizedEmail);
  const user = {
    email: normalizedEmail,
    address: signer.address,
    arcKeyId,
    displayName: nextDisplayName,
    username: buildUniqueUsername(store, baseUsername, normalizedEmail),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.users[normalizedEmail] = user;
  return user;
}

function getStoredUser(store, email) {
  return store.users[normalizeEmail(email)] || null;
}

function resolvePaymentLink(store, { linkId, username, amount }) {
  const normalizedLinkId = String(linkId || "").trim();
  const normalizedUsername = username ? slugifySegment(username) : "";
  const normalizedAmount = amount ? String(amount).trim() : "";

  const fromCode = normalizedLinkId ? readPaymentLinkFromCode(normalizedLinkId) : null;

  if (fromCode) {
    if (
      (!normalizedUsername || fromCode.username === normalizedUsername) &&
      (!normalizedAmount || fromCode.amount === normalizedAmount)
    ) {
      fromCode.url = buildPaymentLinkUrl(fromCode);
      return fromCode;
    }
  }

  const candidates = [...store.paymentLinks].reverse();

  return candidates.find((link) => {
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
        direction === "incoming" ? Promise.resolve([]) : contract.queryFilter(outgoingFilter, fromBlock, latestBlock),
        direction === "outgoing" ? Promise.resolve([]) : contract.queryFilter(incomingFilter, fromBlock, latestBlock),
        contract.decimals()
      ]);

      const seen = new Set();
      const mergedLogs = [...incomingLogs, ...outgoingLogs].filter((log) => {
        const key = `${log.transactionHash}-${log.index}-${tokenConfig.symbol}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

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

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter(Boolean);

const app = express();
app.use(express.json());
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

function mapStoredUser(user) {
  if (!user) {
    return null;
  }

  return {
    email: user.email,
    address: user.address,
    arcKeyId: user.arcKeyId,
    displayName: user.displayName,
    username: user.username
  };
}

function resolveOwnerIdentity(store, { email, displayName } = {}) {
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
  const [rawBalance, decimals] = await Promise.all([
    tokenContract.balanceOf(address),
    tokenContract.decimals()
  ]);

  return {
    symbol: tokenConfig.symbol,
    address: tokenConfig.address,
    balance: ethers.formatUnits(rawBalance, decimals)
  };
}

async function fetchAllTokenBalances(address) {
  const entries = await Promise.all(
    Object.keys(TOKENS).map(async (token) => [token, await fetchTokenBalance(address, token)])
  );

  return Object.fromEntries(entries);
}

async function executeTokenTransfer({ to, amount, email, token }) {
  const tokenConfig = getTokenConfig(token);

  if (!tokenConfig) {
    throw new Error(buildTokenError());
  }

  if (!to || !amount || !email) {
    throw new Error("Missing required fields: to, amount, email, token");
  }

  const { signer } = walletFromEmail(email);
  const signerAddress = await signer.getAddress();

  if (!ethers.isAddress(to)) {
    throw new Error("Invalid recipient address");
  }

  const tokenContract = getTokenContract(tokenConfig.symbol, signer);
  const [rawTokenBalance, decimals, nativeBalance, feeData] = await Promise.all([
    tokenContract.balanceOf(signerAddress),
    tokenContract.decimals(),
    provider.getBalance(signerAddress),
    provider.getFeeData()
  ]);

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
      `Insufficient ARC for gas. Have ${ethers.formatUnits(nativeBalance, 18)} ARC, need about ${ethers.formatUnits(estimatedGasCost, 18)} ARC.`
    );
  }

  console.log(`Sending ${amount} ${tokenConfig.symbol} from ${signerAddress} to ${to}`);

  const tx = await tokenContract.transfer(to, value, overrides);
  const receipt = await tx.wait();
  const transactionHash = receipt?.hash || receipt?.transactionHash || tx.hash;

  console.log(`Transaction sent: ${transactionHash}`);

  return {
    status: "ok",
    hash: transactionHash,
    from: signerAddress,
    to,
    amount,
    token: tokenConfig.symbol,
    symbol: tokenConfig.symbol,
    explorer: buildExplorerUrl(transactionHash)
  };
}

function mapStoredPayment(payment) {
  return {
    id: payment.id,
    linkId: payment.linkId,
    linkLabel: payment.linkLabel,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    transactionHash: payment.transactionHash,
    explorerUrl: payment.explorerUrl,
    paidAt: payment.paidAt
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

app.post("/auth/login", async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const store = readStore();
    const user = ensureUserRecord(store, { email, displayName });
    const balances = await fetchAllTokenBalances(user.address);
    writeStore(store);

    res.json({
      ...mapStoredUser(user),
      balances,
      network: "arc-testnet"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/users/profile", (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const store = readStore();
    const user = getStoredUser(store, email);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(mapStoredUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/users/profile", (req, res) => {
  try {
    const { email, displayName } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const store = readStore();
    const user = ensureUserRecord(store, { email, displayName });
    writeStore(store);

    res.json(mapStoredUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.get("/balances", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    const balances = await fetchAllTokenBalances(address);
    res.json({ address, balances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/txs", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    const store = readStore();
    const storedTxs = store.txs.filter((tx) => tx.from === address || tx.to === address);
    const onchainTxs = await fetchTokenTransferHistory(address, { direction: "all" });
    const txs = mergeUniqueByKey(
      storedTxs,
      onchainTxs,
      (tx) => `${tx.hash || tx.transactionHash}-${tx.symbol || tx.token || "ARC"}`
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ txs, address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/send-transaction", async (req, res) => {
  try {
    const transfer = await executeTokenTransfer(req.body);
    const store = readStore();

    store.txs.unshift({
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      symbol: transfer.symbol,
      token: transfer.token,
      status: "confirmed",
      explorer: transfer.explorer,
      timestamp: new Date().toISOString()
    });

    writeStore(store);
    res.json(transfer);
  } catch (err) {
    console.error("Send transaction error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/payment-links", (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);
    const store = readStore();
    const paymentLinks = [...store.paymentLinks]
      .filter((link) => !ownerEmail || link.ownerEmail === ownerEmail)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((link) => ({
        ...link,
        url: buildPaymentLinkUrl(link)
      }));

    res.json(paymentLinks);
  } catch (err) {
    console.error("List payment links error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/payment-links/resolve", (req, res) => {
  try {
    const username = slugifySegment(req.query.username);
    const amount = String(req.query.amount || "").trim();
    const linkId = String(req.query.linkId || "").trim();

    if (!linkId && (!username || !amount)) {
      return res.status(400).json({ error: "Link ID or username and amount are required" });
    }

    const store = readStore();
    const paymentLink = resolvePaymentLink(store, { username, amount, linkId });

    if (!paymentLink) {
      return res.status(404).json({ error: "Payment link not found" });
    }

    paymentLink.url = buildPaymentLinkUrl(paymentLink);
    res.json(paymentLink);
  } catch (err) {
    console.error("Resolve payment link error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment-links", async (req, res) => {
  try {
    const { amount, description, currency, ownerEmail, ownerName } = req.body;
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

    const store = readStore();
    const owner = resolveOwnerIdentity(store, { email: ownerEmail, displayName: ownerName });
    const id = crypto.randomUUID();
    const normalizedAmount = normalizeAmount(amount);
    const paymentLink = {
      id,
      username: owner.username || DEFAULT_OWNER_USERNAME,
      ownerName: owner.displayName,
      ownerEmail: owner.email,
      recipientAddress: owner.address,
      amount: normalizedAmount,
      description: description?.trim() || "",
      currency: tokenConfig.symbol,
      status: "active",
      createdAt: new Date().toISOString()
    };

    paymentLink.linkCode = buildSignedPaymentLinkCode(paymentLink);
    paymentLink.url = buildPaymentLinkUrl(paymentLink);
    store.paymentLinks.push(paymentLink);
    writeStore(store);

    res.status(201).json(paymentLink);
  } catch (err) {
    console.error("Create payment link error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/payments", async (req, res) => {
  try {
    const ownerEmail = normalizeEmail(req.query.ownerEmail);
    const store = readStore();
    const storedPayments = [...store.payments]
      .filter((payment) => !ownerEmail || payment.ownerEmail === ownerEmail)
      .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
      .map(mapStoredPayment);

    if (!ownerEmail) {
      return res.json(storedPayments);
    }

    const { signer } = walletFromEmail(ownerEmail);
    const onchainIncoming = (await fetchTokenTransferHistory(signer.address, { direction: "incoming" }))
      .map((tx) => ({
        id: tx.id,
        linkId: tx.hash,
        linkLabel: "Incoming transfer",
        amount: tx.amount,
        currency: tx.currency,
        status: "completed",
        transactionHash: tx.hash,
        explorerUrl: tx.explorerUrl,
        paidAt: tx.paidAt
      }));

    const payments = mergeUniqueByKey(
      storedPayments,
      onchainIncoming,
      (payment) => payment.transactionHash || payment.id
    ).sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

    res.json(payments);
  } catch (err) {
    console.error("List payments error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment-links/:linkId/send-code", async (req, res) => {
  try {
    const { linkId } = req.params;
    const payerEmail = normalizeEmail(req.body.payerEmail);
    const store = readStore();

    const paymentLink = resolvePaymentLink(store, { linkId });

    if (!paymentLink) {
      return res.status(404).json({ error: "Payment link not found" });
    }

    if (paymentLink.status !== "active") {
      return res.status(400).json({ error: "This payment link is not active" });
    }

    if (!payerEmail) {
      return res.status(400).json({ error: "Payer email is required" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_CODE_TTL_MINUTES * 60 * 1000).toISOString();
    const challengeId = buildPaymentChallengeToken({
      linkId,
      payerEmail,
      codeHash: hashOtpCode(code),
      expiresAt
    });

    await sendVerificationCodeEmail({
      to: payerEmail,
      code,
      paymentLink
    });

    res.json({
      challengeId,
      payerEmail,
      message: `We sent a verification code to ${payerEmail}.`
    });
  } catch (err) {
    console.error("Send verification code error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment-links/:linkId/confirm-payment", async (req, res) => {
  const { linkId } = req.params;
  const payerEmail = normalizeEmail(req.body.payerEmail);
  const verificationCode = String(req.body.verificationCode || "").trim();
  const challengeId = String(req.body.challengeId || "").trim();
  const store = readStore();
  const paymentLink = resolvePaymentLink(store, { linkId });

  if (!paymentLink) {
    return res.status(404).json({ error: "Payment link not found" });
  }

  if (paymentLink.status !== "active") {
    return res.status(400).json({ error: "This payment link is not active" });
  }

  if (!payerEmail || !verificationCode || !challengeId) {
    return res.status(400).json({ error: "Email, verification code, and challenge ID are required" });
  }

  const challenge = readPaymentChallengeToken(challengeId);

  if (!challenge) {
    return res.status(400).json({ error: "Verification session expired. Please request a new code." });
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
      token: paymentLink.currency
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
      recipientAddress: paymentLink.recipientAddress,
      transactionHash: transfer.hash,
      explorerUrl: transfer.explorer,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    store.payments.unshift(payment);
    store.txs.unshift({
      hash: transfer.hash,
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      symbol: transfer.symbol,
      token: transfer.token,
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
      recipientAddress: paymentLink.recipientAddress,
      error: err.message,
      createdAt: new Date().toISOString()
    };

    store.payments.unshift(failedPayment);
    writeStore(store);

    console.error("Payment link confirm error:", err);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(4000, () => console.log("Arc Wallet Backend Live on :4000"));
}

module.exports = app;
