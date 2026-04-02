const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { ethers } = require("ethers");

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

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
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

    console.log(`User Logged In: ${signer.address}`);

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

    res.json({ txs: [], address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/send-transaction", async (req, res) => {
  try {
    const { to, amount, email, token } = req.body;
    const tokenConfig = getTokenConfig(token);

    if (!to || !amount || !email || !tokenConfig) {
      return res.status(400).json({
        error: !tokenConfig ? buildTokenError() : "Missing required fields: to, amount, email, token"
      });
    }

    const { signer } = walletFromEmail(email);
    const signerAddress = await signer.getAddress();

    if (!ethers.isAddress(to)) {
      return res.status(400).json({ error: "Invalid recipient address" });
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
      return res.status(400).json({
        error: `Insufficient ${tokenConfig.symbol}. Have ${ethers.formatUnits(rawTokenBalance, decimals)} ${tokenConfig.symbol}, need ${ethers.formatUnits(value, decimals)} ${tokenConfig.symbol}.`
      });
    }

    const gasLimit = BigInt(100000);
    const overrides = { gasLimit };

    if (feeData.gasPrice != null) {
      overrides.gasPrice = feeData.gasPrice;
    }

    const estimatedGasCost = gasLimit * (overrides.gasPrice || BigInt(0));

    if (nativeBalance < estimatedGasCost) {
      return res.status(400).json({
        error: `Insufficient ARC for gas. Have ${ethers.formatUnits(nativeBalance, 18)} ARC, need about ${ethers.formatUnits(estimatedGasCost, 18)} ARC.`
      });
    }

    console.log(`Sending ${amount} ${tokenConfig.symbol} from ${signerAddress} to ${to}`);

    const tx = await tokenContract.transfer(to, value, overrides);

    console.log(`Transaction sent: ${tx.hash}`);

    await tx.wait();

    res.json({
      status: "ok",
      hash: tx.hash,
      from: signerAddress,
      to,
      amount,
      token: tokenConfig.symbol,
      symbol: tokenConfig.symbol,
      explorer: `https://testnet.arcscan.app/tx/${tx.hash}`
    });
  } catch (err) {
    console.error("Send transaction error:", err);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(4000, () => console.log("Arc Wallet Backend Live on :4000"));
}

module.exports = app;
