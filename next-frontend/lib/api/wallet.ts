import { backendFetch } from "./backend";
import type { WalletBalanceWarnings, WalletBalances, WalletLoginChallenge, WalletTransaction, WalletUser } from "@/lib/types/wallet";

export async function checkBackend() {
  return backendFetch<{ status: string; message: string }>("/health");
}

export async function sendWalletLoginCode(email: string, displayName?: string) {
  return backendFetch<WalletLoginChallenge>("/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ email, displayName }),
  });
}

export async function verifyWalletLoginCode(
  email: string,
  verificationCode: string,
  challengeId: string,
  displayName?: string,
) {
  return backendFetch<WalletUser>("/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, verificationCode, challengeId, displayName }),
  });
}

export async function updateWalletProfile(email: string, displayName?: string) {
  return backendFetch<WalletUser>("/users/profile", {
    method: "POST",
    body: JSON.stringify({ email, displayName }),
  });
}

export async function fetchWalletBalances(address: string) {
  return backendFetch<{ address: string; balances: WalletBalances; warnings?: WalletBalanceWarnings }>(
    `/balances?address=${encodeURIComponent(address)}`,
  );
}

export async function fetchWalletTransactions(address: string) {
  return backendFetch<{ address: string; txs: WalletTransaction[] }>(
    `/txs?address=${encodeURIComponent(address)}`,
  );
}

export async function sendWalletTransaction(payload: {
  to: string;
  amount: string;
  email: string;
  arcKeyId?: string;
  token: string;
  memo?: string;
  walletSessionToken?: string;
}) {
  return backendFetch<{
    hash: string;
    symbol: string;
    token: string;
    explorer: string;
    from: string;
    to: string;
    amount: string;
    memo?: string;
    memoId?: string;
    memoReference?: string;
    memoMode?: string;
  }>("/send-transaction", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
