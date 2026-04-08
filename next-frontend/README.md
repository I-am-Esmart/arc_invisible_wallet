# VeloxPay Frontend

This is the separate Next.js App Router frontend for the VeloxPay payment-link product.

## Run locally

1. Copy `.env.example` to `.env.local`
2. Set:

```bash
BACKEND_API_URL=http://localhost:4000
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
WALLET_APP_BASE_URL=https://arc-wallet.vercel.app
RESEND_API_KEY=re_xxxxxxxxx
OTP_FROM_EMAIL=VeloxPay <onboarding@resend.dev>
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
FRONTEND_ORIGIN=https://arc-wallet.vercel.app,https://veloxpay.vercel.app
PAYMENT_LINK_OWNER_EMAIL=your-owner-email@example.com
PAYMENT_LINK_OWNER_USERNAME=emmanuel
PAYMENT_LINK_BASE_URL=https://veloxpay.vercel.app
PAYMENT_LINK_DEFAULT_CURRENCY=USDC
WALLET_APP_BASE_URL=https://arc-wallet.vercel.app
RESEND_API_KEY=re_xxxxxxxxx
OTP_FROM_EMAIL=VeloxPay <your-verified-sender@domain.com>
```

### Next frontend project

Root directory:

```bash
next-frontend
```

Set:

```bash
BACKEND_API_URL=https://arc-invisible-wallet.vercel.app
NEXT_PUBLIC_BUILDER_X_URL=https://x.com/cryptosmart121
```

Current deployed URLs:
- VeloxPay: `https://veloxpay.vercel.app/`
- Wallet app: `https://arc-wallet.vercel.app/`
- Backend: `https://arc-invisible-wallet.vercel.app/`

## Notes

- This frontend does not implement wallet or blockchain logic.
- File-based storage on Vercel uses `/tmp`, which is fine for demos but not durable enough for production data.
- Payments now use one-time email verification, so the backend must be configured with a working Resend sender before live testing.
