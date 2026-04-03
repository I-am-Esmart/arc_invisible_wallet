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

## Expected backend endpoints

- `GET /payment-links/resolve?username=:username&amount=:amount`
- `GET /payment-links`
- `POST /payment-links`
- `GET /payments`
- `POST /payment-links/:linkId/pay`

## Notes

- This frontend does not implement wallet or blockchain logic.
- All payment execution stays in the existing Node.js backend.
