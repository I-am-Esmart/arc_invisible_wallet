# Arc Payment Links Frontend

This is a separate Next.js App Router frontend for the payment-link product.

## Run locally

1. Copy `.env.example` to `.env.local`
2. Set:

```bash
BACKEND_API_URL=http://localhost:4000
```

3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

The Next app runs on `http://localhost:3000`.

## Expected backend endpoints

- `GET /payment-links/resolve?username=:username&amount=:amount`
- `GET /payment-links`
- `POST /payment-links`
- `GET /payments`
- `POST /payment-links/:linkId/pay`

## Required backend env for payment links

```bash
PAYMENT_LINK_OWNER_EMAIL=emmanuel@example.com
PAYMENT_LINK_OWNER_USERNAME=emmanuel
PAYMENT_LINK_BASE_URL=http://localhost:3000
PAYMENT_LINK_DEFAULT_CURRENCY=USDC
```

## Vercel deployment

### Backend project

Root directory:

```bash
backend/server
```

Set these environment variables:

```bash
ARC_RPC=https://rpc.testnet.arc.network
FRONTEND_ORIGIN=https://your-vite-frontend.vercel.app,https://your-next-frontend.vercel.app
PAYMENT_LINK_OWNER_EMAIL=your-owner-email@example.com
PAYMENT_LINK_OWNER_USERNAME=emmanuel
PAYMENT_LINK_BASE_URL=https://your-next-frontend.vercel.app
PAYMENT_LINK_DEFAULT_CURRENCY=USDC
```

### Next frontend project

Root directory:

```bash
next-frontend
```

Set:

```bash
BACKEND_API_URL=https://your-backend.vercel.app
```

## Notes

- This frontend does not implement wallet or blockchain logic.
- All payment execution stays in the existing Node.js backend.
