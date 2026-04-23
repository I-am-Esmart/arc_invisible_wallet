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
2. Point the frontend to your backend URL in `.env.local`

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

Use `../backend/server/.env.example` as the source of truth for backend configuration.

## Vercel deployment

### Backend project

Root directory:

```bash
backend/server
```

Set these environment variables:

Use `../backend/server/.env.example`.

### Next frontend project

Root directory:

```bash
next-frontend
```

Set:

```bash
BACKEND_API_URL=<your-backend-url>
NEXT_PUBLIC_BACKEND_API_URL=<your-backend-url>
NEXT_PUBLIC_BUILDER_X_URL=<your-x-profile-url>
```

## Notes

- This frontend uses the existing backend wallet and blockchain logic.
- File-based storage on Vercel uses `/tmp`, which is fine for demos but not durable enough for production data.
- Keep secrets and mail credentials only in environment variables, not in docs or committed files.
