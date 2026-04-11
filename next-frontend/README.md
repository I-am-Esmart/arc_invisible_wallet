# VeloxPay Frontend

This is the main Next.js App Router frontend for VeloxPay.

It now combines:
- wallet create/restore with email
- wallet balances
- send and receive
- wallet activity history
- payment link creation
- incoming payment tracking

## Run locally

1. Copy `.env.example` to `.env.local`
2. Set:

```bash
BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:4000
NEXT_PUBLIC_BUILDER_X_URL=https://x.com/cryptosmart121
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
- `POST /payment-links/:linkId/send-code`
- `POST /payment-links/:linkId/confirm-payment`

## Required backend env for payment links

```bash
PAYMENT_LINK_OWNER_EMAIL=emmanuel@example.com
PAYMENT_LINK_OWNER_USERNAME=emmanuel
PAYMENT_LINK_BASE_URL=http://localhost:3000
PAYMENT_LINK_DEFAULT_CURRENCY=USDC
PAYMENT_LINK_SIGNING_SECRET=change-this-to-a-random-secret
WALLET_APP_BASE_URL=https://veloxpay.vercel.app
LOG_QUERY_CHUNK_SIZE=5000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=useveloxpay@gmail.com
SMTP_PASS=your-16-character-google-app-password
OTP_FROM_EMAIL="VeloxPay <useveloxpay@gmail.com>"
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
FRONTEND_ORIGIN=https://veloxpay.vercel.app
PAYMENT_LINK_OWNER_EMAIL=your-owner-email@example.com
PAYMENT_LINK_OWNER_USERNAME=emmanuel
PAYMENT_LINK_BASE_URL=https://veloxpay.vercel.app
PAYMENT_LINK_DEFAULT_CURRENCY=USDC
PAYMENT_LINK_SIGNING_SECRET=change-this-to-a-random-secret
WALLET_APP_BASE_URL=https://veloxpay.vercel.app
LOG_QUERY_CHUNK_SIZE=5000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=useveloxpay@gmail.com
SMTP_PASS=your-16-character-google-app-password
OTP_FROM_EMAIL="VeloxPay <useveloxpay@gmail.com>"
```

### Next frontend project

Root directory:

```bash
next-frontend
```

Set:

```bash
BACKEND_API_URL=https://arc-invisible-wallet.vercel.app
NEXT_PUBLIC_BACKEND_API_URL=https://arc-invisible-wallet.vercel.app
NEXT_PUBLIC_BUILDER_X_URL=https://x.com/cryptosmart121
```

Current deployed URLs:
- VeloxPay: `https://veloxpay.vercel.app/`
- Backend: `https://arc-invisible-wallet.vercel.app/`

## Notes

- This frontend uses the existing backend wallet and blockchain logic.
- File-based storage on Vercel uses `/tmp`, which is fine for demos but not durable enough for production data.
- Payments now use one-time email verification, and for your current setup you can use Gmail SMTP with an app password instead of buying a domain first.
