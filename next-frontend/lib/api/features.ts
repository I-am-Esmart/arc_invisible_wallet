import { backendFetch } from "./backend";
import type { FeatureCapabilities, FeatureStatus } from "@/lib/types/features";

export async function fetchFeatureCapabilities() {
  return backendFetch<FeatureCapabilities>("/features");
}

export async function fetchCustodyOptions() {
  return backendFetch<FeatureStatus>("/wallet/custody-options");
}

export async function createUserControlledWalletSession(email: string) {
  return backendFetch<FeatureStatus>("/wallets/user-controlled/session", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchUnifiedBalance(address: string) {
  return backendFetch<FeatureStatus>(`/unified-balance?address=${encodeURIComponent(address)}`);
}

export async function quoteBridge(payload: {
  fromChain: string;
  toChain: string;
  amount: string;
  token: string;
}) {
  return backendFetch<FeatureStatus>("/bridge/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function quoteSwap(payload: {
  fromToken: string;
  toToken: string;
  amount: string;
  chain?: string;
}) {
  return backendFetch<FeatureStatus>("/swaps/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchSettlementReport(ownerEmail: string) {
  return backendFetch<FeatureStatus>(
    `/payments/settlement-report?ownerEmail=${encodeURIComponent(ownerEmail)}`,
  );
}

export async function simulateTransaction(payload: {
  email: string;
  to: string;
  amount: string;
  token: string;
}) {
  return backendFetch<FeatureStatus>("/transactions/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendBatchTransfers(payload: {
  email: string;
  transfers: Array<{ to: string; amount: string; token: string }>;
}) {
  return backendFetch<FeatureStatus>("/batch-transfers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
