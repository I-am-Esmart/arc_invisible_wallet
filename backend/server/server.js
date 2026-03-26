const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { ethers } = require("ethers");

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(express.json());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: true
}));

// 1. ARC TESTNET SETTINGS (Chain ID: 5042002)
const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC || "https://rpc.testnet.arc.network");

/* --------------------------------------------------
   DETERMINISTIC WALLET DERIVATION
-------------------------------------------------- */
function walletFromEmail(email) {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(email || "default"));
  const arcKeyId = `arc-${hash.slice(2, 12)}`;
  const privateKey = ethers.keccak256(ethers.toUtf8Bytes(arcKeyId));
  return { 
    signer: new ethers.Wallet(privateKey, provider),
    arcKeyId 
  };
}

/* --------------------------------------------------
   ENDPOINTS
-------------------------------------------------- */

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Arc Wallet Backend is running" });
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const { signer, arcKeyId } = walletFromEmail(email);
    
    // FORCE FETCH FROM ARC RPC
    const rawBalance = await provider.getBalance(signer.address);
    // Arc native token uses 18 decimals (like ETH), not 6
    const balance = ethers.formatUnits(rawBalance, 18); 

    console.log(`User Logged In: ${signer.address} | Balance: ${balance} USDC`);

    res.json({
      email,
      address: signer.address,
      arcKeyId,
      balance,
      symbol: "USDC",
      network: "arc-testnet"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/balance", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    const raw = await provider.getBalance(address);
    const balance = ethers.formatUnits(raw, 18);
    
    res.json({ balance, symbol: "USDC", address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/txs", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address required" });

    // Arc testnet doesn't have a simple way to fetch tx history from RPC
    // Return empty array - frontend uses localStorage for tx history
    res.json({ txs: [], address });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/send-transaction", async (req, res) => {
  try {
    const { to, amount, email } = req.body;
    
    if (!to || !amount || !email) {
      return res.status(400).json({ 
        error: "Missing required fields: to, amount, email" 
      });
    }

    // Resolve signer from email
    const { signer } = walletFromEmail(email);
    const signerAddress = await signer.getAddress();

    // Validate recipient address
    if (!ethers.isAddress(to)) {
      return res.status(400).json({ error: "Invalid recipient address" });
    }

    // Arc uses 18 decimals for native token
    const value = ethers.parseUnits(amount.toString(), 18);
    
    // Get current gas price from Arc
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const gasLimit = BigInt(21000);
    const totalNeeded = value + (gasLimit * gasPrice);

    const balanceRaw = await provider.getBalance(signerAddress);

    if (balanceRaw < totalNeeded) {
      return res.status(400).json({
        error: `Insufficient USDC. Have ${ethers.formatUnits(balanceRaw, 18)} USDC, need ~${ethers.formatUnits(totalNeeded, 18)} USDC.`
      });
    }

    console.log(`Sending ${amount} USDC from ${signerAddress} to ${to}`);

    const tx = await signer.sendTransaction({
      to,
      value,
      gasLimit,
      gasPrice
    });

    console.log(`Transaction sent: ${tx.hash}`);

    // Wait for confirmation before returning the tx metadata used by the frontend.
    await tx.wait();

    res.json({
      status: "ok",
      hash: tx.hash,
      from: signerAddress,
      to,
      amount,
      explorer: `https://testnet.arcscan.app/tx/${tx.hash}`
    });

  } catch (err) {
    console.error("Send transaction error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("🚀 Arc Wallet Backend Live on :4000"));
