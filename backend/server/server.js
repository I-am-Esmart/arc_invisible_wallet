const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 value) returns (bool)"
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

const STORE_PATH = path.join(__dirname, "data", "store.json");
const DEFAULT_OWNER_USERNAME = process.env.PAYMENT_LINK_OWNER_USERNAME || "emmanuel";
const DEFAULT_OWNER_EMAIL = process.env.PAYMENT_LINK_OWNER_EMAIL || "emmanuel@example.com";
const DEFAULT_LINK_CURRENCY = (process.env.PAYMENT_LINK_DEFAULT_CURRENCY || "USDC").toUpperCase();
const DEFAULT_LINK_BASE_URL = (process.env.PAYMENT_LINK_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

function normalizeOrigin(origin) {
  return origin.replace(/\/$/, "");
}

function normalizeToken(token) {
  return (token || "USDC").toUpperCase();
}

function getTokenConfig(token) {
  return TOKENS[normalizeToken(token)] || null;
}

function buildTokenError() {
  return `Unsupported token. Supported tokens: ${Object.keys(TOKENS).join(", ")}`;
}

function createEmptyStore() {
  return {
    users: {},
    wallets: {},
    txs: [],
    paymentLinks: [],
    payments: []
  };
}

function ensureStoreFile() {
  const storeDir = path.dirname(STORE_PATH);

  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(createEmptyStore(), null, 2));
  }
}

function readStore() {
  ensureStoreFile();

  const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));

  return {
    ...createEmptyStore(),
    ...parsed,
    txs: Array.isArray(parsed.txs) ? parsed.txs : [],
    paymentLinks: Array.isArray(parsed.paymentLinks) ? parsed.paymentLinks : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : []
  };
}

function writeStore(store) {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
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
  const hash = ethers.keccak256(ethers.toUtf8Bytes(email || "default"));
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

function resolveOwnerIdentity() {
  const { signer } = walletFromEmail(DEFAULT_OWNER_EMAIL);

  return {
    username: DEFAULT_OWNER_USERNAME,
    email: DEFAULT_OWNER_EMAIL,
    address: signer.address
  };
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

  const value = ethers.parseUnits(amount.toString(), decimals);

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

  console.log(`Transaction sent: ${tx.hash}`);

  await tx.wait();

  return {
    status: "ok",
    hash: tx.hash,
    from: signerAddress,
    to,
    amount,
    token: tokenConfig.symbol,
    symbol: tokenConfig.symbol,
    explorer: `https://testnet.arcscan.app/tx/${tx.hash}`
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
    paidAt: payment.paidAt
  };
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Arc Wallet Backend is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Arc Wallet Backend is running" });
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const { signer, arcKeyId } = walletFromEmail(email);
    const balances = await fetchAllTokenBalances(signer.address);
    const store = readStore();

    store.users[email] = {
      email,
      address: signer.address,
      arcKeyId,
      updatedAt: new Date().toISOString()
    };
    writeStore(store);

    res.json({
      email,
      address: signer.address,
      arcKeyId,
      balances,
      network: "arc-testnet"
    });
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
    const txs = store.txs.filter((tx) => tx.from === address || tx.to === address);

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
    const store = readStore();
    const paymentLinks = [...store.paymentLinks].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json(paymentLinks);
  } catch (err) {
    console.error("List payment links error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/payment-links/resolve", (req, res) => {
  try {
    const { username, amount } = req.query;

    if (!username || !amount) {
      return res.status(400).json({ error: "Username and amount are required" });
    }

    const store = readStore();
    const paymentLink = [...store.paymentLinks]
      .reverse()
      .find((link) => link.username === username && link.amount === amount && link.status === "active");

    if (!paymentLink) {
      return res.status(404).json({ error: "Payment link not found" });
    }

    res.json(paymentLink);
  } catch (err) {
    console.error("Resolve payment link error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment-links", async (req, res) => {
  try {
    const { amount, description, currency } = req.body;
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

    const owner = resolveOwnerIdentity();
    const store = readStore();
    const id = crypto.randomUUID();
    const normalizedAmount = Number(amount).toString();

    const paymentLink = {
      id,
      username: owner.username,
      ownerEmail: owner.email,
      recipientAddress: owner.address,
      amount: normalizedAmount,
      description: description?.trim() || "",
      currency: tokenConfig.symbol,
      status: "active",
      createdAt: new Date().toISOString(),
      url: `${DEFAULT_LINK_BASE_URL}/${owner.username}/${normalizedAmount}`
    };

    store.paymentLinks.push(paymentLink);
    writeStore(store);

    res.status(201).json(paymentLink);
  } catch (err) {
    console.error("Create payment link error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/payments", (req, res) => {
  try {
    const store = readStore();
    const payments = [...store.payments]
      .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
      .map(mapStoredPayment);

    res.json(payments);
  } catch (err) {
    console.error("List payments error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/payment-links/:linkId/pay", async (req, res) => {
  const { linkId } = req.params;
  const { payerEmail } = req.body;
  const store = readStore();
  const paymentLink = store.paymentLinks.find((link) => link.id === linkId);

  if (!paymentLink) {
    return res.status(404).json({ error: "Payment link not found" });
  }

  if (paymentLink.status !== "active") {
    return res.status(400).json({ error: "This payment link is not active" });
  }

  if (!payerEmail) {
    return res.status(400).json({ error: "Payer email is required" });
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
      linkLabel: `/${paymentLink.username}/${paymentLink.amount}`,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      status: "completed",
      payerEmail,
      recipientAddress: paymentLink.recipientAddress,
      transactionHash: transfer.hash,
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
      linkLabel: `/${paymentLink.username}/${paymentLink.amount}`,
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

    console.error("Payment link pay error:", err);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(4000, () => console.log("Arc Wallet Backend Live on :4000"));
}

module.exports = app;
