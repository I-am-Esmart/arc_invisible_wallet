# Arc Wallet

An Arc testnet invisible wallet demo built with React, Express, and ethers.js.

The app lets a user log in with email, view USDC and EURC balances, send either stablecoin, copy a receive address, open Arc explorer links, and check locally stored transaction history.

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
- `FRONTEND_ORIGIN=http://localhost:5173`

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

## Fresh Vercel deployment

Deploy the frontend and backend as two separate Vercel projects.

### Backend project

Root directory:
- `backend/server`

Required environment variables:
- `ARC_RPC=https://rpc.testnet.arc.network`
- `FRONTEND_ORIGIN=https://your-frontend-domain.vercel.app`

### Frontend project

Root directory:
- `frontend`

Required environment variable:
- `VITE_API_BASE_URL=https://your-backend-domain.vercel.app`

After deployment:
1. Copy the backend production URL.
2. Add that URL as `VITE_API_BASE_URL` in the frontend project.
3. Copy the frontend production URL.
4. Add that URL as `FRONTEND_ORIGIN` in the backend project.
5. Redeploy both projects so the updated env vars are applied.

## Faucet steps

To get Arc testnet USDC or EURC:
1. Visit `https://faucet.circle.com/`
2. Choose `USDC` or `EURC`
3. Choose `Arc Testnet` in the network tab

## Notes

- This is a demo implementation and should not be used in production.
- The goal is to demonstrate invisible wallet UX with email-based access and recovery.
