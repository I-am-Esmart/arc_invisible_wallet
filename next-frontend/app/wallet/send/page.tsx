"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";

const TOKEN_OPTIONS = [
  { value: "USDC", label: "USDC" },
  { value: "EURC", label: "EURC" },
] as const;

export default function WalletSendPage() {
  const { walletUser, sendFromWallet } = useVeloxPayData();
  const [token, setToken] = useState<(typeof TOKEN_OPTIONS)[number]["value"]>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");

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
      const result = await sendFromWallet({ to, amount, token });
      setSuccess(`Sent ${result.amount} ${result.symbol}.`);
      setExplorerUrl(result.explorer);
      setTo("");
      setAmount("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send transaction.");
    } finally {
      setLoading(false);
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

          <Button type="submit" className="w-full py-3 text-base" disabled={loading}>
            {loading ? "Sending..." : `Send ${token}`}
          </Button>
        </form>
      </Card>
    </main>
  );
}
