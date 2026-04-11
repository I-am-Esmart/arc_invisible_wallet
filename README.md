# VeloxPay

VeloxPay is an Arc testnet wallet and payment-link product built with Next.js, Express, and ethers.js.

The main user experience now lives in `next-frontend/`, where a user can create or restore a wallet with email, view USDC and EURC balances, send and receive funds, review wallet activity, create payment links, and track incoming payments from one dashboard.

The older Vite wallet frontend still exists in `frontend/` as a legacy client, but VeloxPay is the primary frontend.

## Running locally

### 1. Start the backend

```bash
cd backend/server
npm install
npm start
```

The backend runs on `http://localhost:4000`.

Important backend env values:
- `ARC_RPC=https://rpc.testnet.arc.network`
- `FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000`
- `PAYMENT_LINK_OWNER_EMAIL=emmanuel@example.com`
- `PAYMENT_LINK_OWNER_USERNAME=emmanuel`
- `PAYMENT_LINK_BASE_URL=http://localhost:3000`
- `PAYMENT_LINK_DEFAULT_CURRENCY=USDC`
- `PAYMENT_LINK_SIGNING_SECRET=change-this-to-a-random-secret`
- `WALLET_APP_BASE_URL=https://veloxpay.vercel.app`
- `LOG_QUERY_CHUNK_SIZE=5000`
- `MAX_HISTORY_ITEMS=20`
- `TX_RECEIPT_POLL_INTERVAL_MS=4000`
- `TX_RECEIPT_TIMEOUT_MS=120000`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=useveloxpay@gmail.com`
- `SMTP_PASS=your-16-character-google-app-password`
- `OTP_FROM_EMAIL="VeloxPay <useveloxpay@gmail.com>"`

You can copy `backend/server/.env.example` to `.env` and adjust values if needed.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

Important frontend env value:
- `VITE_API_BASE_URL=http://localhost:4000`

You can copy `frontend/.env.example` to `.env.local` for local development.

### 3. Start the Next.js payment-links frontend

```bash
cd next-frontend
npm install
npm run dev
```

The Next.js app runs on `http://localhost:3000`.

Important Next.js env values:
- `BACKEND_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:4000`

## Fresh Vercel deployment

Deploy the backend and the Next.js VeloxPay frontend as the primary live experience. The older Vite frontend is optional now.

### Backend project

Root directory:
- `backend/server`

Required environment variables:
- `ARC_RPC=https://rpc.testnet.arc.network`
- `FRONTEND_ORIGIN=https://veloxpay.vercel.app`
- `PAYMENT_LINK_OWNER_EMAIL=your-owner-email@example.com`
- `PAYMENT_LINK_OWNER_USERNAME=emmanuel`
- `PAYMENT_LINK_BASE_URL=https://veloxpay.vercel.app`
- `PAYMENT_LINK_DEFAULT_CURRENCY=USDC`
- `PAYMENT_LINK_SIGNING_SECRET=change-this-to-a-random-secret`
- `WALLET_APP_BASE_URL=https://veloxpay.vercel.app`
- `LOG_QUERY_CHUNK_SIZE=5000`
- `MAX_HISTORY_ITEMS=20`
- `TX_RECEIPT_POLL_INTERVAL_MS=4000`
- `TX_RECEIPT_TIMEOUT_MS=120000`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=useveloxpay@gmail.com`
- `SMTP_PASS=your-16-character-google-app-password`
- `OTP_FROM_EMAIL="VeloxPay <useveloxpay@gmail.com>"`

### Next.js frontend project

Root directory:
- `next-frontend`

Required environment variable:
- `BACKEND_API_URL=https://arc-invisible-wallet.vercel.app`
- `NEXT_PUBLIC_BACKEND_API_URL=https://arc-invisible-wallet.vercel.app`
- `NEXT_PUBLIC_BUILDER_X_URL=https://x.com/cryptosmart121`

Current deployed URLs:
- VeloxPay: `https://veloxpay.vercel.app/`
- Backend: `https://arc-invisible-wallet.vercel.app/`

After deployment:
1. Copy the backend production URL.
2. Add that URL as both `BACKEND_API_URL` and `NEXT_PUBLIC_BACKEND_API_URL` in the Next.js frontend project.
3. Set `FRONTEND_ORIGIN` in the backend project to your VeloxPay frontend URL.
4. Set `PAYMENT_LINK_BASE_URL` and `WALLET_APP_BASE_URL` in the backend project to your VeloxPay frontend URL.
7. Redeploy the backend and both frontend projects so the updated env vars are applied.

## Faucet steps

To get Arc testnet USDC or EURC:
1. Visit `https://faucet.circle.com/`
2. Choose `USDC` or `EURC`
3. Choose `Arc Testnet` in the network tab

## Notes

- This is a demo implementation and should not be used in production.
- The goal is to demonstrate invisible wallet UX with email-based access and recovery.
- File-based storage on Vercel uses the writable `/tmp` runtime path, which is fine for demos but not durable storage for production data.
- Payment approvals on VeloxPay now rely on one-time email verification. For your current setup you can use Gmail SMTP with an app password; Resend can stay as an optional fallback for later.
