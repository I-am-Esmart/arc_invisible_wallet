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

Copy `backend/server/.env.example` to `.env` and fill in the values you actually want to use.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

Copy `frontend/.env.example` to `.env.local` for local development.

### 3. Start the Next.js payment-links frontend

```bash
cd next-frontend
npm install
npm run dev
```

The Next.js app runs on `http://localhost:3000`.

Copy `next-frontend/.env.example` to `.env.local` and point it to your backend.

## Fresh Vercel deployment

Deploy the backend and the Next.js VeloxPay frontend as the primary live experience. The older Vite frontend is optional now.

### Backend project

Root directory:
- `backend/server`

Use `backend/server/.env.example` as the source of truth for required backend environment variables.

### Next.js frontend project

Root directory:
- `next-frontend`

Use `next-frontend/.env.example` as the source of truth for required frontend environment variables.

After deployment:
1. Copy the backend production URL.
2. Add that URL as both `BACKEND_API_URL` and `NEXT_PUBLIC_BACKEND_API_URL` in the Next.js frontend project.
3. Set `FRONTEND_ORIGIN` in the backend project to your VeloxPay frontend URL.
4. Set `PAYMENT_LINK_BASE_URL` and `WALLET_APP_BASE_URL` in the backend project to your VeloxPay frontend URL.
5. Redeploy the backend and frontend projects so the updated env vars are applied.

## Faucet steps

To get Arc testnet USDC or EURC:
1. Visit `https://faucet.circle.com/`
2. Choose `USDC` or `EURC`
3. Choose `Arc Testnet` in the network tab

## Notes

- This is a demo implementation and should not be used in production.
- The goal is to demonstrate invisible wallet UX with email-based access and recovery.
- File-based storage on Vercel uses the writable `/tmp` runtime path, which is fine for demos but not durable storage for production data.
- Payment approvals on VeloxPay rely on one-time email verification. Keep secrets only in environment variables, not in docs or committed files.
