# Arc/Circle SDK Refactoring & New Features Analysis
**Generated: May 19, 2026**

---

## OVERVIEW

Your app is currently built on Arc (by Circle) but uses raw ethers.js for most blockchain operations and custom implementations for several features. Below is a comprehensive analysis of:

1. **Code/Features that can be REFACTORED** to use Circle/Arc SDKs
2. **NEW FEATURES AVAILABLE** in Circle/Arc that you can add to enhance the app

---

## PART 1: REFACTORING OPPORTUNITIES
### (Replace custom code with Arc/Circle SDKs)

---

### 1. **Wallet Creation & Key Management** ⭐ HIGH PRIORITY

**Current Implementation:**
- Manual deterministic wallet derivation from email: `keccak256(keccak256(normalized_email))`
- Uses ethers.js `Wallet` class directly
- Custom Arc Key ID generation: `arc-{hash.slice(2,12)}`
- Private key stored/managed manually

**Why Refactor:**
- Circle Wallets SDK provides enterprise-grade key custody and signing
- Eliminates manual key management risk
- Adds recovery mechanisms, backup options

**Arc/Circle Solution:**
- Use **Circle Developer-Controlled Wallets API** for server-side wallet creation
  - API endpoint: `POST /v1/wallets`
  - Automatically handles key storage and signing
  - Returns wallet ID for easy reference
  
**Recommended Implementation:**
```typescript
// BEFORE (current manual approach)
const derivedPrivateKey = keccak256(keccak256(normalizedEmail));
const signer = new ethers.Wallet(derivedPrivateKey, provider);

// AFTER (Circle API)
const walletResponse = await circleAPI.createWallet({
  idempotencyKey: generateUUID(),
  accountType: "SCA", // Smart Contract Account for gas sponsorship
  walletSetId: userEmail, // Link to user
});
const walletId = walletResponse.data.walletId;
```

**Benefits:**
- ✅ No private keys in your database
- ✅ Built-in key recovery options
- ✅ Compliance-ready key storage
- ✅ Support for multi-sig wallets if needed

**Files to Refactor:**
- [backend/server/server.js](backend/server/server.js#L900-L950) (ensureUserRecord function)
- [backend/server/server.js](backend/server/server.js#L1437-L1480) (executeTokenTransfer function)

---

### 2. **Transaction Signing & Execution** ⭐ HIGH PRIORITY

**Current Implementation:**
- Manual transaction building and signing with ethers.js
- Custom gas estimation (hardcoded 100K limit)
- Raw `contract.transfer()` calls
- Custom tx receipt polling with 4-5s intervals, 120s timeout

**Why Refactor:**
- Circle Wallets SDK handles all signing automatically
- Built-in transaction optimization and monitoring
- Real-time transaction status via webhooks (no polling needed)

**Arc/Circle Solution:**
- **Circle Wallets SDK** `executeTransactionUserOperation()` for signing
- **Circle Webhooks** for real-time tx status (replaces polling)

**Recommended Implementation:**
```typescript
// BEFORE (current manual approach)
const signer = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(tokenAddress, ABI, signer);
const tx = await contract.transfer(recipientAddress, amount);
const receipt = await tx.wait(); // Polling loop

// AFTER (Circle SDK)
const result = await circleWallets.executeTransaction({
  walletId: userWalletId,
  to: tokenAddress,
  data: encodeTokenTransfer(recipientAddress, amount),
  gasLimit: "100000", // Automatic optimization
});
// Listen to webhook for tx.confirmed status instead of polling
```

**Benefits:**
- ✅ Eliminates polling loops (reduces server load)
- ✅ Automatic gas optimization
- ✅ Real-time notifications via webhooks
- ✅ Transaction simulation before execution

**Files to Refactor:**
- [backend/server/server.js](backend/server/server.js#L1739-L1785) (send-transaction endpoint)
- [backend/server/server.js](backend/server/server.js#L1437-L1480) (executeTokenTransfer function)

---

### 3. **Gas Fee Management** ⭐⭐ HIGH PRIORITY

**Current Implementation:**
- Users must hold native ARC tokens for gas
- Manual balance validation against gas cost
- No abstraction of gas fees from users

**Why Refactor:**
- Circle **Gas Station** eliminates need for native token holdings
- Users can pay gas with USDC instead
- Can sponsor gas completely (developer pays)

**Arc/Circle Solution:**

**Option A: Gas Station (Developer sponsors gas)**
```typescript
// Sponsor gas for user transactions
const result = await circleWallets.executeTransaction({
  walletId: userWalletId,
  paymaster: true, // Enable Gas Station
  to: tokenAddress,
  data: encodeTokenTransfer(recipient, amount),
});
// Developer pays 5% of gas cost via credit card
// User needs NO native tokens
```

**Option B: Circle Paymaster (Users pay in USDC)**
- Permissionless paymaster at: `0x...` (address varies by chain)
- Users pay 10% surcharge on gas in USDC
- Can be integrated without Circle account

**Recommended:**
- **Option A for payments**: Sponsor gas → better UX, no native token confusion
- **Option B as fallback**: USDC gas payment → if users need self-service

**Benefits:**
- ✅ Seamless user experience (no native token requirements)
- ✅ Lower developer costs (5% vs manual management)
- ✅ Works across all supported chains

**Files to Remove/Update:**
- [backend/server/server.js](backend/server/server.js#L1750-L1770) (gas validation logic)
- Remove manual gas estimation and balance checks

---

### 4. **Transaction History & Event Monitoring** ⭐ MEDIUM PRIORITY

**Current Implementation:**
- Manual `queryFilter()` on token contract with block chunking (50K blocks max)
- Custom data storage in JSON file
- Manual filtering and pagination

**Why Refactor:**
- Circle **Webhooks API** provides real-time transaction events
- **Circle Gateway** offers unified balance queries across chains
- Reduces complexity of event filtering

**Arc/Circle Solution:**
```typescript
// INSTEAD OF: queryFilter() with chunking
// USE: Webhook notifications

// Set up webhook for transfer events
await circleAPI.subscribeToNotifications({
  endpoint: "https://yourapp.com/webhooks/transactions",
  notificationTypes: ["payment.confirmed", "payment.failed"],
});

// Webhook handler
app.post("/webhooks/transactions", (req, res) => {
  const { data } = req.body;
  // Real-time tx updates (no polling needed)
  saveTransactionToDatabase(data);
});
```

**Benefits:**
- ✅ Real-time updates (no 5-10 second polling delay)
- ✅ Reduces blockchain RPC calls
- ✅ Automatic retry logic for failed notifications
- ✅ Signed webhooks (security verification built-in)

**Files to Refactor:**
- [backend/server/server.js](backend/server/server.js#L200-L250) (token contract queries)
- Create webhook handler for transaction events

---

### 5. **Email-Based Authentication (OTP)** ⭐ MEDIUM PRIORITY

**Current Implementation:**
- Custom OTP generation (6-digit codes)
- Email delivery via nodemailer
- Challenge token with hash validation
- Manual expiry management (10 min default)

**Why Refactor:**
- Circle **Wallets SDK** supports passkeys (WebAuthn) for phishing-resistant auth
- Alternatively: Keep email OTP but use Circle's managed identity system

**Arc/Circle Solution - Passkey-based (Recommended for security):**
```typescript
// Switch from email OTP to passkeys
const authResult = await circleWallets.authenticateWithPasskey({
  userId: userEmail,
  challenge: generateChallenge(),
});
// Users approve on their device (WebAuthn standard)
// Much more secure than email OTP
```

**Arc/Circle Solution - Enhanced Email OTP (Current comfort):**
```typescript
// Keep email OTP but use Circle's managed auth
await circleAuth.sendOTP({
  email: userEmail,
  expirySeconds: 600,
});
```

**Recommendation:**
- **Long-term**: Migrate to passkeys (more secure)
- **Short-term**: Keep current email OTP (minimal changes)

**Files to Refactor (if passkeys):**
- [backend/server/server.js](backend/server/server.js#L1561-L1620) (auth endpoints)
- [frontend/src/components/Login.jsx](frontend/src/components/Login.jsx)

---

### 6. **Token Balance Queries** ⭐ MEDIUM PRIORITY

**Current Implementation:**
- Direct contract calls to read USDC/EURC balances
- Manual ARC native balance query
- Separate queries per token

**Why Refactor:**
- Circle **Gateway API** provides unified balance queries
- **Unified Balance** feature (App Kit) for cross-chain balances
- Single API call replaces multiple contract queries

**Arc/Circle Solution:**
```typescript
// BEFORE: Multiple separate calls
const usdcBalance = await usdcContract.balanceOf(userAddress);
const eurcBalance = await eurcContract.balanceOf(userAddress);
const arcBalance = await provider.getBalance(userAddress);

// AFTER: Single unified call (if cross-chain)
const balances = await gateway.getBalance({
  address: userAddress,
  chains: ["Arc_Testnet", "Base", "Arbitrum"],
});
// Returns: { USDC: "100.50", EURC: "50.25", ARC: "5.00" }
```

**Benefits:**
- ✅ Single API call vs 3 separate calls
- ✅ Automatic token price conversion available
- ✅ Cross-chain balance aggregation (new feature!)

**Files to Refactor:**
- [backend/server/server.js](backend/server/server.js#L1300-L1350) (getTokenBalance function)
- [frontend/src/lib/api.js](frontend/src/lib/api.js)

---

---

## PART 2: NEW FEATURES TO ADD
### (Available in Arc/Circle that your app doesn't have yet)

---

### 1. **Cross-Chain USDC Bridging** ⭐⭐⭐ HIGH VALUE

**What It Is:**
Users can send USDC to other blockchains (Ethereum, Polygon, Base, Arbitrum, Solana, etc.)

**Why Add It:**
- Users not restricted to Arc chain only
- Unlocks new use case: "send money globally to any blockchain"
- Simple API (Arc App Kit handles complexity)

**Implementation:**
```typescript
// User sends 10 USDC from Arc → Polygon
const bridgeResult = await kit.bridge({
  from: { 
    adapter: viemAdapter, 
    chain: "Arc_Testnet",
    address: userAddress
  },
  to: { 
    adapter: viemAdapter, 
    chain: "Polygon_Mainnet",
    address: recipientAddress 
  },
  amount: "10.00",
  token: "USDC",
});
// Takes 15-20 seconds (Standard) or 8-20s (Fast)
```

**UI Changes Needed:**
- Add "Bridge" tab in Send screen
- Select destination chain
- Show bridge duration (Fast vs Standard)
- Real-time bridge status tracking

**Files to Add:**
- `frontend/src/pages/Bridge.jsx` (new page)
- `backend/server/routes/bridge.js` (new endpoint)
- [frontend/src/lib/api.js](frontend/src/lib/api.js) - add bridge methods

**Effort:** 2-3 days (SDK handles heavy lifting)

---

### 2. **Unified Balance (Multi-Chain)** ⭐⭐⭐ HIGH VALUE

**What It Is:**
Single balance combining USDC from multiple chains. Spend from anywhere instantly.

**Example:**
- User has: 100 USDC on Arc, 50 USDC on Base, 25 USDC on Polygon
- Unified Balance shows: 175 USDC (total)
- User spends 180 USDC on Arc → automatically pulls from other chains

**Why Add It:**
- Massive UX improvement (no chain selection confusion)
- Users don't need to manage per-chain balances
- Payment links can work across chains seamlessly

**Implementation:**
```typescript
// Deposit from multiple chains into Unified Balance
await kit.unifiedBalance.deposit({
  from: { adapter: viemAdapter, chain: "Arc_Testnet" },
  amount: "100.00",
  token: "USDC",
});

await kit.unifiedBalance.deposit({
  from: { adapter: viemAdapter, chain: "Base" },
  amount: "50.00",
  token: "USDC",
});

// Now spend from unified balance on any chain
await kit.unifiedBalance.spend({
  amount: "175.00",
  from: { adapter: viemAdapter },
  to: {
    adapter: viemAdapter,
    chain: "Polygon",
    recipientAddress: "0x..."
  },
});
// Automatically bridges needed funds
```

**UI Changes:**
- Show "Unified Balance" total in dashboard
- "Add funds from" modal for multi-chain deposits
- "Spend from unified balance" option in send flow

**Files to Add:**
- `frontend/src/components/UnifiedBalance.jsx` (new component)
- `backend/server/routes/unified-balance.js` (new endpoint)

**Effort:** 3-4 days

---

### 3. **Webhooks for Real-Time Updates** ⭐⭐ MEDIUM VALUE

**What It Is:**
Receive real-time notifications instead of polling for:
- Transaction confirmations
- Payment link completions
- Balance changes
- Settlement status

**Why Add It:**
- Better UX (instant updates vs 5-10s delay)
- Reduces server load (no polling loops)
- More reliable than polling
- Can enable notifications to users

**Implementation:**
```typescript
// Set up webhook endpoint
app.post("/webhooks/circle", (req, res) => {
  const { type, data } = req.body;
  
  if (type === "payment.confirmed") {
    // Real-time payment notification
    emitToUserViaWebSocket(data.userId, {
      status: "Payment received!",
      amount: data.amount,
    });
  }
  
  if (type === "transaction.confirmed") {
    // Real-time tx confirmation
    updateTransactionStatus(data.transactionId, "confirmed");
  }
});

// Subscribe to notifications
await circleAPI.subscribeToNotifications({
  endpoint: "https://yourapp.com/webhooks/circle",
  notificationTypes: ["*"],
});
```

**Event Types Available:**
- `payment.confirmed` / `payment.failed`
- `transaction.confirmed` / `transaction.failed`
- `transfer.completed` / `transfer.failed`
- `account.created` / `account.updated`
- `wallet.created` / `wallet.updated`

**UI Changes:**
- Add real-time toast notifications
- WebSocket connection for live updates
- Remove polling loops

**Files to Add:**
- `backend/server/webhooks.js` (webhook handler)
- `frontend/src/hooks/useRealtimeUpdates.js` (WebSocket hook)

**Effort:** 1-2 days

---

### 4. **Paymaster (USDC Gas Payments)** ⭐⭐ MEDIUM VALUE

**What It Is:**
Let users pay for gas with USDC instead of native tokens

**Why Add It:**
- Users never need to hold Arc/Eth/Polygon native tokens
- Clear pricing (just 10% surcharge)
- Permissionless (no Circle account needed)

**Implementation:**
```typescript
// User pays for transaction with USDC instead of ARC
const result = await circleWallets.executeTransaction({
  walletId: userWalletId,
  to: tokenAddress,
  data: encodeTokenTransfer(recipient, amount),
  gasPaymentToken: "USDC", // Pay gas with USDC
  paymentGasLimit: "100000",
});
// 10% surcharge automatically added to user's USDC balance reduction
```

**This Would Replace:**
- Current ARC balance requirements
- Manual gas validation

**Files to Refactor:**
- [backend/server/server.js](backend/server/server.js#L1750-L1770) (gas validation)

**Effort:** 1-2 days

---

### 5. **Modular Wallets with Passkeys** ⭐⭐ MEDIUM VALUE

**What It Is:**
Phishing-resistant authentication using passkeys (WebAuthn) + smart account wallets

**Why Add It:**
- More secure than email OTP (phishing-resistant)
- Biometric login (fingerprint, face ID)
- Industry standard (FIDO2, WebAuthn)
- Optional recovery keys if device lost

**Implementation:**
```typescript
// Signup with passkey
const registerResult = await circleWallets.registerPasskey({
  userId: userEmail,
  displayName: userName,
});

// Login with passkey
const loginResult = await circleWallets.authenticateWithPasskey({
  userId: userEmail,
  challenge: generateChallenge(),
});
// User confirms on device (biometric or PIN)
```

**UI Changes:**
- Replace email/OTP login with passkey button
- "Register passkey" on first login
- "Use recovery key" fallback if device unavailable

**Files to Refactor:**
- [backend/server/server.js](backend/server/server.js#L1561-L1620) (auth endpoints)
- [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx)
- [veloxpay/app/login/page.tsx](veloxpay/app/login/page.tsx)

**Effort:** 2-3 days

---

### 6. **Multi-Signature Wallets** ⭐ LOWER PRIORITY

**What It Is:**
Require 2+ approvals for transactions (e.g., M-of-N signers)

**Why Add It:**
- Security for higher-value transfers
- Team wallets (group accounts)
- Better for payment link automation

**Implementation:**
```typescript
// Create 2-of-3 multisig wallet
const wallet = await circleWallets.createWallet({
  accountType: "SCA",
  signingConstraint: {
    type: "multi-sig",
    threshold: 2,
    signers: [signer1Id, signer2Id, signer3Id],
  },
});
```

**Files to Add:**
- `backend/server/routes/wallets.js` (multisig endpoint)

**Effort:** 2-3 days

---

### 7. **Settlement & Reporting** ⭐ LOWER PRIORITY

**What It Is:**
Daily/monthly reports, fiat conversion, line of credit

**Why Add It:**
- Accounting integration
- Dashboard metrics (GMV, settlements)
- Fiat conversion if building payment processor

**Available Features:**
- Daily/monthly settlement reports
- USDC-to-fiat conversion pricing
- Transaction-level reporting API
- Settlement tracking via webhooks

**Implementation:** Enterprise feature (requires Circle Managed Payments account)

**Effort:** 1-2 weeks (requires backend integration)

---

### 8. **Batch Transactions** ⭐ MEDIUM VALUE

**What It Is:**
Execute multiple transactions in single operation

**Why Add It:**
- Send payments to multiple recipients at once
- Better UX (single approval, atomic execution)
- Cheaper gas (batched execution)

**Implementation:**
```typescript
// Send to 5 recipients in one operation
const result = await circleWallets.executeBatchUserOperation({
  walletId: userWalletId,
  operations: [
    { to: recipient1, amount: "10", token: "USDC" },
    { to: recipient2, amount: "20", token: "USDC" },
    { to: recipient3, amount: "15", token: "USDC" },
    // ... up to 50 operations
  ],
  nonce: 1, // Optional: for parallel execution
});
```

**Use Cases:**
- "Send to multiple" feature in app
- Payroll distribution
- Dividend payouts

**Files to Add:**
- `frontend/src/pages/BatchSend.jsx` (new page)
- `backend/server/routes/batch.js` (new endpoint)

**Effort:** 2-3 days

---

### 9. **Transaction Simulation** ⭐ MEDIUM VALUE

**What It Is:**
Preview transaction outcome before submitting (gas cost, slippage, failures)

**Why Add It:**
- Catch errors before user pays gas
- Show accurate fees upfront
- Prevent failed transactions

**Implementation:**
```typescript
// Simulate before sending
const simulation = await circleWallets.simulateTransaction({
  walletId: userWalletId,
  to: tokenAddress,
  data: encodeTokenTransfer(recipient, amount),
});

console.log({
  estimatedGas: simulation.gas,
  gasPrice: simulation.gasPrice,
  totalCost: simulation.total,
  willSucceed: simulation.success,
  revertReason: simulation.revertReason, // if fails
});
```

**UI Changes:**
- Show "Estimated fee: $0.50" before user clicks send
- Display "Simulating..." state during check

**Effort:** 1 day

---

### 10. **In-App Token Swaps** ⭐⭐ MEDIUM VALUE

**What It Is:**
Swap between USDC, EURC, other stablecoins within app

**Why Add It:**
- Liquidity access for users
- Revenue opportunity (% on swaps)
- Better UX (no external DEX needed)

**Implementation:**
```typescript
// Swap USDC → EURC
const quoteResult = await gateway.getQuote({
  sourceToken: "USDC",
  destinationToken: "EURC",
  amount: "100.00",
});

const swapResult = await kit.swap({
  from: { adapter: viemAdapter, chain: "Arc_Testnet" },
  sourceToken: "USDC",
  destinationToken: "EURC",
  amount: "100.00",
  slippageTolerance: "1%", // Max 1% price slippage
});
```

**Files to Add:**
- `frontend/src/pages/Swap.jsx` (new page)
- `backend/server/routes/swaps.js` (new endpoint)

**Effort:** 2-3 days

---

---

## PRIORITY ROADMAP RECOMMENDATION

### Phase 1 (Weeks 1-2) - **Stability & Gas Improvements**
1. Refactor to Circle Developer-Controlled Wallets
2. Implement Gas Station (sponsor user gas)
3. Add webhook-based transaction monitoring

### Phase 2 (Weeks 3-4) - **Multi-Chain Capabilities**
4. Add Cross-Chain Bridging (CCTP)
5. Implement Unified Balance
6. Enable Paymaster (USDC gas payment)

### Phase 3 (Weeks 5-6) - **Security & UX**
7. Migrate to Passkey authentication
8. Add transaction simulation
9. Implement batch transactions

### Phase 4 (Weeks 7+) - **Advanced Features**
10. In-app token swaps
11. Multi-sig wallets
12. Settlement reporting

---

## SDK INSTALLATION QUICKSTART

```bash
# Circle Wallets SDK
npm install @circle-fin/wallets

# Arc App Kit (Bridge + Unified Balance)
npm install @circle-fin/app-kit

# Adapters (choose what you need)
npm install @circle-fin/adapter-viem-v2 viem
npm install @circle-fin/adapter-ethers-v6 ethers

# Optional: Circle Paymaster SDK
npm install @circle-fin/paymaster
```

---

## API CREDENTIALS SETUP

1. Create Circle Developer Account: https://console.circle.com
2. Generate API key in Dashboard
3. Add to `.env`:
   ```
   CIRCLE_API_KEY=your_api_key_here
   CIRCLE_API_URL=https://api.circle.com/v1
   CIRCLE_ENTITY_SECRET=your_entity_secret
   ```

---

## ESTIMATED TOTAL EFFORT

- **Refactoring Current Features:** 3-4 weeks
- **Adding New Features (top 5):** 2-3 weeks
- **Total (full implementation):** 5-7 weeks

---

## SUPPORT & RESOURCES

- Circle Docs: https://developers.circle.com
- Arc Docs: https://docs.arc.io
- Circle Discord: https://discord.com/invite/buildoncircle
- Arc Discord: https://discord.com/invite/buildonarc
- Postman Collection: https://developers.circle.com/wallets/postman
