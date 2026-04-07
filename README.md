# Arc Wallet

An Arc testnet invisible wallet demo built with React, Express, and ethers.js.

The app lets a user log in with email, view USDC and EURC balances, send either stablecoin, copy a receive address, open Arc explorer links, and check locally stored transaction history.

There is also a separate Next.js payment-links frontend in `next-frontend/` for the VeloxPay payment-link product.

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

Important Next.js env value:
- `BACKEND_API_URL=http://localhost:4000`

## Fresh Vercel deployment

Deploy the backend, the Vite frontend, and the Next.js payment-links frontend as separate Vercel projects if you want both frontends live.

### Backend project

Root directory:
- `backend/server`

Required environment variables:
- `ARC_RPC=https://rpc.testnet.arc.network`
- `FRONTEND_ORIGIN=https://arc-wallet.vercel.app,https://veloxpay.vercel.app`
- `PAYMENT_LINK_OWNER_EMAIL=your-owner-email@example.com`
- `PAYMENT_LINK_OWNER_USERNAME=emmanuel`
- `PAYMENT_LINK_BASE_URL=https://veloxpay.vercel.app`
- `PAYMENT_LINK_DEFAULT_CURRENCY=USDC`

### Frontend project

Root directory:
- `frontend`

Required environment variable:
- `VITE_API_BASE_URL=https://arc-invisible-wallet.vercel.app`

### Next.js payment-links project

Root directory:
- `next-frontend`

Required environment variable:
- `BACKEND_API_URL=https://arc-invisible-wallet.vercel.app`

Current deployed URLs:
- Wallet app: `https://arc-wallet.vercel.app/`
- VeloxPay: `https://veloxpay.vercel.app/`
- Backend: `https://arc-invisible-wallet.vercel.app/`

After deployment:
1. Copy the backend production URL.
2. Add that URL as `VITE_API_BASE_URL` in the frontend project.
3. Copy the frontend production URL.
4. Add that URL as `FRONTEND_ORIGIN` in the backend project.
5. Add the backend URL to the Next.js payment-links project as `BACKEND_API_URL`.
6. Add the Next.js payment-links URL to the backend `FRONTEND_ORIGIN` list and set `PAYMENT_LINK_BASE_URL` to that URL.
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
