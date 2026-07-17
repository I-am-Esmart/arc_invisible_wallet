"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { simulateTransaction } from "@/lib/api/features";
import type { FeatureStatus } from "@/lib/types/features";

const TOKEN_OPTIONS = [
  { value: "USDC", label: "USDC" },
  { value: "EURC", label: "EURC" },
] as const;

export default function WalletSendPage() {
  const { walletUser, sendFromWallet } = useVeloxPayData();
  const [token, setToken] = useState<(typeof TOKEN_OPTIONS)[number]["value"]>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");
  const [simulation, setSimulation] = useState<FeatureStatus | null>(null);

  if (!walletUser) {
    return <WalletRequiredState />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setExplorerUrl("");

    try {
      const result = await sendFromWallet({ to, amount, token, memo });
      setSuccess(`Sent ${result.amount} ${result.symbol}.`);
      setExplorerUrl(result.explorer);
      setTo("");
      setAmount("");
      setMemo("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send transaction.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulate() {
    if (!walletUser) {
      return;
    }

    setError("");
    setSimulation(null);

    try {
      const result = await simulateTransaction({
        email: walletUser.email,
        to,
        amount,
        token,
      });
      setSimulation(result);
    } catch (simulateError) {
      setError(simulateError instanceof Error ? simulateError.message : "Unable to simulate transaction.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Wallet send</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Send from your wallet</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/wallet">Back to wallet</Link>
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Token</span>
            <select
              value={token}
              onChange={(event) => setToken(event.target.value as "USDC" | "EURC")}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {TOKEN_OPTIONS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Recipient address</span>
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="0x..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1.00"
              type="number"
              min="0"
              step="0.000001"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Memo</span>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Invoice, payout reason, or note"
              maxLength={180}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {error ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

          {success ? (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
              <p>{success}</p>
              {explorerUrl ? (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-medium text-brand-600 hover:underline">
                  View on Arc Explorer
                </a>
              ) : null}
            </div>
          ) : null}

          {simulation ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Arc transaction preview</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p>Status: {String(simulation.status || "unknown")}</p>
                <p>Gas token: {String(simulation.gasToken || "USDC")}</p>
                <p>Estimated network fee: {String(simulation.estimatedNetworkFee || "-")} USDC</p>
                <p>Finality: {String(simulation.finality || "single confirmation")}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="secondary" className="py-3 text-base" disabled={loading || !to || !amount} onClick={handleSimulate}>
              Preview fees
            </Button>
            <Button type="submit" className="py-3 text-base" disabled={loading}>
              {loading ? "Sending..." : `Send ${token}`}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
