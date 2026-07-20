# AGENTS.md

## Repository Architecture

- `backend/server/`: Node.js + Express CommonJS API. It owns wallet creation/restoration, Circle developer-controlled wallet integration, Arc token transfers, payment links, OTP, receipts, timelines, Redis/KV persistence, batch payouts, bridge/swap/unified-balance groundwork, and Circle webhooks.
- `veloxpay/`: Primary VeloxPay frontend. Next.js App Router + React + TypeScript. It owns the wallet workspace, payment-link creation, public payment pages, payments/receipts views, and advanced feature UI.
- `frontend/`: Legacy Vite + React client. Keep it working when touched, but prefer `veloxpay/` for primary product work.
- Root docs include `README.md`, `BLUEPRINT.md`, and `REFACTORING_AND_NEW_FEATURES.md`.

## Package Manager And Commands

Package manager: npm.

Backend:
- Dev: `cd backend/server && npm run dev`
- Start: `cd backend/server && npm start`
- Test: `cd backend/server && npm test` currently exits with "no test specified"

Primary frontend:
- Dev: `cd veloxpay && npm run dev`
- Lint: `cd veloxpay && npm run lint`
- Build: `cd veloxpay && npm run build`

Legacy frontend:
- Dev: `cd frontend && npm run dev`
- Lint: `cd frontend && npm run lint`
- Build: `cd frontend && npm run build`

Run relevant tests, lint, and build after every task. If a command cannot be run or is known to be unavailable, report that clearly.

## Naming And Conventions

- Use TypeScript in `veloxpay/`; keep shared types in `veloxpay/lib/types/`.
- Use centralized frontend API wrappers in `veloxpay/lib/api/`.
- Use wallet/session helpers from `veloxpay/lib/session/`.
- Use existing UI primitives from `veloxpay/components/ui/` and existing product components before adding new components.
- Backend code is currently CommonJS in `backend/server/server.js`; follow local style when editing backend code.
- Existing product naming is VeloxPay. Avoid reintroducing old "Invisible Wallet" naming except where preserving legacy code behavior.

## Reuse Requirements

- Reuse existing backend services and helpers for users, wallets, payment links, payments, receipts, timelines, token transfers, Circle wallets, Redis/KV persistence, customers, and transaction polling.
- Reuse existing frontend components and data hooks such as `useVeloxPayData`, `CreateLinkForm`, `PaymentLinksTable`, `PaymentsTable`, `PaymentLinkCard`, `PayButton`, `PaymentStatus`, and `PaymentTimeline`.
- Preserve existing wallet creation/restoration, payment-link creation/resolution/completion, and receipt functionality.
- Do not edit unrelated code or perform broad refactors unless required for the task.
- Do not add dependencies unless necessary; prefer existing dependencies and platform APIs.

## Security And Correctness

- Never expose Circle API keys, Circle entity secrets, Redis/KV credentials, wallet credentials, private keys, or signing secrets to client-side code.
- Keep secret-bearing operations in the backend only.
- Use integer token base units internally for token amounts. Never use JavaScript floating-point arithmetic for token value accounting or settlement math.
- Validate all wallet addresses with a proper address validator before transfers or persisted settlement instructions.
- Validate all payment amounts: required, positive, supported token, valid precision for token decimals, and safe base-unit conversion.
- Use idempotency keys for all Circle write operations.
- Keep payment and wallet mutations protected by the existing session/OTP model unless a task explicitly changes auth.

## Reporting

After each task, report:
- Files changed.
- Commands executed and whether they passed, failed, or were skipped.
- Any test/lint/build gaps or remaining risks.

Do not implement VeloxPay Smart Requests unless explicitly asked.
