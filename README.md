# Invisible Wallet (Arc-style demo)

A simple “invisible wallet” demo built with React + Express + ethers.js.

The backend stores user wallets by email (demo only) and the frontend lets you log in, send ETH, view balance, and see transaction history.

---

## 🚀 Running locally

### 1) Start backend

```bash
cd backend/server
npm install
npm start
```

The backend will listen on **http://localhost:4000**.

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open: **http://localhost:5173**

---

## 🗝️ Restore wallet from another device

This demo stores your wallet in a local file (`backend/server/data/store.json`). If you run the backend on a hosted server (e.g. Heroku, Railway, Vercel), you can restore the same wallet from any device by using the same email.

1. Deploy backend to a public host.
2. Update the frontend API URL (`frontend/src/lib/api.js`) to point to the hosted backend.
3. Open the app, choose **Restore Wallet**, and enter the same email used previously.

---

## 🧠 Notes (for submission)

- This is a demo implementation; **do not use it in production** (it stores private keys in plain JSON and trusts email as identity).
- The goal is demonstrating the “invisible wallet” UX: the user never sees a private key, only an email-based restore flow.
