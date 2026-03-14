const express = require("express")
const cors = require("cors")
require("dotenv").config()
const { ethers } = require("ethers")
const fs = require("fs")
const path = require("path")

const app = express()
app.use(cors())
app.use(express.json())

/* --------------------------------------------------
   PROVIDER + RELAYER WALLET
-------------------------------------------------- */

if (!process.env.SEPOLIA_RPC || !process.env.SEPOLIA_PRIVATE_KEY) {
  console.error("Missing required env vars: SEPOLIA_RPC and SEPOLIA_PRIVATE_KEY")
  process.exit(1)
}

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC)
const realWallet = new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider)

/* --------------------------------------------------
   PERSISTED USER/ARC WALLET STORE (demo)
-------------------------------------------------- */

const DATA_DIR = path.join(__dirname, "data")
const STORE_FILE = path.join(DATA_DIR, "store.json")

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadStore() {
  try {
    ensureDataDir()
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify({ users: {}, wallets: {}, txs: [] }, null, 2))
    }
    const raw = fs.readFileSync(STORE_FILE, "utf-8")
    return JSON.parse(raw)
  } catch (err) {
    console.warn("Failed to load store, starting fresh:", err.message)
    return { users: {}, wallets: {} }
  }
}

function saveStore(
  store) {
  try {
    ensureDataDir()
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2))
  } catch (err) {
    console.warn("Failed to persist store:", err.message)
  }
}

const store = loadStore()
const walletStore = new Map(Object.entries(store.wallets))
const userStore = new Map(Object.entries(store.users))

function getTxs() {
  return Array.isArray(store.txs) ? store.txs : []
}

function addTx(tx) {
  if (!Array.isArray(store.txs)) store.txs = []
  store.txs.push(tx)
  saveStore(store)
}

function persist() {
  store.wallets = Object.fromEntries(walletStore.entries())
  store.users = Object.fromEntries(userStore.entries())
  saveStore(store)
}

function makeArcKeyId() {
  return `arc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toUserPayload(item) {
  return {
    email: item.email,
    address: item.address,
    arcKeyId: item.arcKeyId,
  }
}

async function getEthBalance(address) {
  try {
    const raw = await provider.getBalance(address)
    return ethers.formatEther(raw)
  } catch (err) {
    console.warn("Unable to fetch balance (RPC may be unreachable):", err.message)
    // Fallback to 0 when RPC lookup fails (helps keep the UI from crashing)
    return "0"
  }
}

/* --------------------------------------------------
   HEALTH CHECK
-------------------------------------------------- */

app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

/* --------------------------------------------------
   AUTH / USER WALLET ENDPOINTS
-------------------------------------------------- */

app.post("/auth/login", async (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  let arcKeyId = userStore.get(email)

  if (!arcKeyId || !walletStore.has(arcKeyId)) {
    const wallet = ethers.Wallet.createRandom()
    arcKeyId = makeArcKeyId()

    walletStore.set(arcKeyId, {
      email,
      arcKeyId,
      address: wallet.address,
      privateKey: wallet.privateKey,
    })
    userStore.set(email, arcKeyId)
    persist()
  }

  const walletData = walletStore.get(arcKeyId)

  const balance = await getEthBalance(walletData.address)

  res.json({
    ...toUserPayload(walletData),
    balance,
    symbol: "ETH",
    network: "sepolia",
  })
})

app.post("/create-wallet", async (req, res) => {
  const wallet = ethers.Wallet.createRandom()
  const arcKeyId = makeArcKeyId()

  walletStore.set(arcKeyId, {
    email: null,
    arcKeyId,
    address: wallet.address,
    privateKey: wallet.privateKey,
  })
  persist()

  res.json({
    address: wallet.address,
    privateKey: wallet.privateKey,
    arcKeyId,
  })
})

app.post("/get-balance", async (req, res) => {
  try {
    const { address } = req.body
    if (!address) return res.status(400).json({ error: "Missing address" })
    const balance = await getEthBalance(address)
    res.json({ address, balance, symbol: "ETH", network: "sepolia" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post("/sign-message", async (req, res) => {
  try {
    const { message, arcKeyId } = req.body
    if (!message) return res.status(400).json({ error: "Missing message" })
    if (!arcKeyId) return res.status(400).json({ error: "Missing arcKeyId" })

    const userWallet = walletStore.get(arcKeyId)
    if (!userWallet) return res.status(404).json({ error: "Arc key not found" })

    const signer = new ethers.Wallet(userWallet.privateKey)
    const signature = await signer.signMessage(message)

    res.json({ signature, signedBy: userWallet.address })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

/* --------------------------------------------------
   BALANCE / TRANSACTION ENDPOINTS
-------------------------------------------------- */

app.get("/balance", async (req, res) => {
  try {
    const { address } = req.query
    const targetAddress = address || realWallet.address
    const balance = await getEthBalance(targetAddress)
    res.json({
      address: targetAddress,
      balance,
      symbol: "ETH",
      network: "sepolia",
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get("/txs", async (req, res) => {
  try {
    const { address } = req.query
    const txs = getTxs().filter((tx) => {
      if (!address) return true
      return tx.from.toLowerCase() === address.toLowerCase() || tx.to.toLowerCase() === address.toLowerCase()
    })

    res.json({ address: address || null, txs })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post("/send-transaction", async (req, res) => {
  try {
    const { to, amount, fromAddress, arcKeyId } = req.body

    if (!to || !amount) {
      return res.status(400).json({ error: "'to' and 'amount' are required" })
    }

    const value = ethers.parseEther(amount.toString())
    let signer = realWallet

    if (arcKeyId && walletStore.has(arcKeyId)) {
      const userWallet = walletStore.get(arcKeyId)
      signer = new ethers.Wallet(userWallet.privateKey, provider)
    } else if (fromAddress) {
      const found = [...walletStore.values()].find((w) => w.address.toLowerCase() === fromAddress.toLowerCase())
      if (found) {
        signer = new ethers.Wallet(found.privateKey, provider)
      }
    }

    const signerAddress = await signer.getAddress()
    const accountBalance = await provider.getBalance(signerAddress)
    if (accountBalance.lt(value)) {
      return res.status(400).json({ error: "Insufficient balance" })
    }

    const tx = await signer.sendTransaction({ to, value })
    await tx.wait()

    const txRecord = {
      hash: tx.hash,
      from: signerAddress,
      to,
      amount: amount.toString(),
      status: "confirmed",
      timestamp: Date.now(),
    }
    addTx(txRecord)

    res.json({
      status: "ok",
      hash: tx.hash,
      explorer: `https://sepolia.etherscan.io/tx/${tx.hash}`,
    })
  } catch (err) {
    console.error("SEND TRANSACTION ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* --------------------------------------------------
   USDC SETUP (Sepolia)
-------------------------------------------------- */

const USDC_ADDRESS = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function decimals() view returns (uint8)"
]
const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, realWallet)

app.get("/usdc-balance", async (req, res) => {
  try {
    const balance = await usdcContract.balanceOf(realWallet.address)
    res.json({
      address: realWallet.address,
      balance: ethers.formatUnits(balance, 6),
      symbol: "USDC",
      network: "sepolia",
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post("/send-usdc", async (req, res) => {
  try {
    const { to, amount } = req.body
    if (!to || !amount) return res.status(400).json({ error: "Missing 'to' or 'amount'" })

    const parsedAmount = ethers.parseUnits(amount.toString(), 6)
    const balance = await usdcContract.balanceOf(realWallet.address)

    if (balance.lt(parsedAmount)) {
      return res.status(400).json({ error: "Insufficient USDC balance" })
    }

    const tx = await usdcContract.transfer(to, parsedAmount)
    await tx.wait()

    res.json({ status: "ok", hash: tx.hash, explorer: `https://sepolia.etherscan.io/tx/${tx.hash}` })
  } catch (err) {
    console.error("USDC TRANSFER ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

/* --------------------------------------------------
   TEST CONNECTION ON START
-------------------------------------------------- */

async function testConnection() {
  try {
    const network = await provider.getNetwork()
    console.log("✅ Connected to network:", network.name)

    console.log("✅ Relayer wallet address:", realWallet.address)

    const balance = await provider.getBalance(realWallet.address)
    console.log("✅ Relayer wallet balance:", ethers.formatEther(balance), "ETH")
  } catch (err) {
    console.error("❌ Connection test failed:", err.message)
  }
}

testConnection()

if (!process.env.VERCEL) {
  // Only listen when running locally
  app.listen(4000, () => console.log("🚀 Backend running → http://localhost:4000"))
}

module.exports = app
