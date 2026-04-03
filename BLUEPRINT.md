# Payment Link System Blueprint

## 1. System Architecture

- Existing Node.js backend remains the source of truth for wallets, balances, token transfers, payment links, and payment records.
- New Next.js App Router frontend is added as a separate app in `next-frontend/`.
- Next.js is responsible for:
  - rendering public payment pages
  - rendering the authenticated dashboard
  - collecting form input for payment-link creation
  - calling backend APIs from server components and server actions
- Blockchain and wallet logic stay in the backend only.

## 2. Folder Structure

```text
next-frontend/
  app/
    [username]/
      [amount]/
        actions.ts
        error.tsx
        loading.tsx
        page.tsx
    create/
      actions.ts
      page.tsx
    dashboard/
      page.tsx
    globals.css
    layout.tsx
    page.tsx
  components/
    dashboard/
      create-link-form.tsx
      payment-links-table.tsx
      payments-table.tsx
    payment/
      pay-button.tsx
      payment-link-card.tsx
      payment-status.tsx
    ui/
      badge.tsx
      button.tsx
      card.tsx
      field.tsx
  lib/
    api/
      backend.ts
      payment-links.ts
      payments.ts
    types/
      payment-link.ts
      payment.ts
    utils/
      format.ts
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
  tailwind.config.ts
  .env.example
```

## 3. Data Flow

### Public payment page

1. User opens `/[username]/[amount]`
2. Next.js server component fetches payment-link data from backend
3. Page renders username, amount, description, and payment CTA
4. User clicks `Pay`
5. Next.js server action calls backend payment endpoint
6. Backend handles wallet/payment execution and returns payment result
7. Frontend shows success/failure state and transaction hash

### Dashboard

1. User opens `/dashboard`
2. Next.js fetches payment links and payment history from backend
3. Dashboard renders summary tables
4. User opens `/create`
5. User submits amount + description
6. Server action sends creation request to backend
7. Backend returns saved payment link
8. Frontend shows generated public URL

## 4. API Integration Plan

- All backend calls are centralized in `lib/api/`
- Server components use backend-fetch helpers with `cache: "no-store"`
- Mutations use server actions, not client-side direct wallet calls
- Backend base URL is configured with `BACKEND_API_URL`

## 5. Component Breakdown

- `payment-link-card.tsx`
  - displays recipient name, amount, description, token, status
- `pay-button.tsx`
  - client component for pay interaction using server action
- `payment-status.tsx`
  - shows idle / pending / success / failure result states
- `create-link-form.tsx`
  - client form for new payment-link creation
- `payment-links-table.tsx`
  - dashboard list of created links
- `payments-table.tsx`
  - dashboard list of received payments
- `button.tsx`, `card.tsx`, `badge.tsx`, `field.tsx`
  - reusable UI primitives

## 6. State Management Approach

- Server state:
  - loaded in server components from backend APIs
- Form/mutation state:
  - handled with client components + `useActionState`
- No global client store needed for this scope

## 7. Edge Cases

- invalid username/amount route
- missing payment link
- inactive or expired link
- amount mismatch between route and backend record
- backend unavailable
- failed payment submission
- duplicate payment attempts
- payment pending but not yet finalized
- missing transaction hash in response
- malformed backend response
- very long descriptions / usernames
- zero, negative, or invalid amount input on create
