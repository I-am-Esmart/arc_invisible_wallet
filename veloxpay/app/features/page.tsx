"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { quoteBridge, quoteSwap, sendBatchTransfers } from "@/lib/api/features";
import type { FeatureStatus } from "@/lib/types/features";

const EMPTY_BRIDGE = {
  fromChain: "Base Sepolia",
  toChain: "Arc Testnet",
  amount: "10.00",
  token: "USDC",
};

const EMPTY_SWAP = {
  fromToken: "EURC",
  toToken: "USDC",
  amount: "10.00",
};

function ResultCard({ title, result }: { title: string; result: FeatureStatus | null }) {
  if (!result) {
    return null;
  }

  const isConfigured = result.status !== "configuration_required";

  return (
    <div
      className={`rounded-2xl p-4 text-sm ${
        isConfigured
          ? "bg-emerald-50 text-emerald-800"
          : "bg-amber-50 text-amber-900"
      }`}
    >
      <div className="font-semibold">{title}</div>
      <p className="mt-2 leading-6">
        {typeof result.message === "string"
          ? result.message
          : isConfigured
            ? "This flow is ready to continue."
            : "This flow needs one more backend configuration step before it can run live."}
      </p>
      {typeof result.route === "string" ? <p className="mt-2">Route: {result.route}</p> : null}
      {typeof result.estimatedDuration === "string" ? (
        <p className="mt-1">Estimated timing: {result.estimatedDuration}</p>
      ) : null}
      {typeof result.nextStep === "string" ? <p className="mt-2">{result.nextStep}</p> : null}
    </div>
  );
}

export default function FeaturesPage() {
  const { walletUser } = useVeloxPayData({ includeBalances: false });
  const [bridgeForm, setBridgeForm] = useState(EMPTY_BRIDGE);
  const [swapForm, setSwapForm] = useState(EMPTY_SWAP);
  const [batchRows, setBatchRows] = useState("");
  const [bridgeQuote, setBridgeQuote] = useState<FeatureStatus | null>(null);
  const [swapQuote, setSwapQuote] = useState<FeatureStatus | null>(null);
  const [batchResult, setBatchResult] = useState<FeatureStatus | null>(null);
  const [error, setError] = useState("");

  const batchTransfers = useMemo(
    () =>
      batchRows
        .split("\n")
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
          const [to, amount, token = "USDC", memo = ""] = row.split(",").map((value) => value.trim());
          return { to, amount, token, memo };
        }),
    [batchRows],
  );

  if (!walletUser) {
    return <WalletRequiredState title="Create your wallet before using advanced tools" />;
  }

  async function handleBridgeQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      setBridgeQuote(await quoteBridge(bridgeForm));
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "Unable to quote bridge.");
    }
  }

  async function handleSwapQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      setSwapQuote(await quoteSwap(swapForm));
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "Unable to quote swap.");
    }
  }

  async function handleBatchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!walletUser) {
      return;
    }

    setError("");

    try {
      setBatchResult(await sendBatchTransfers({ email: walletUser.email, transfers: batchTransfers }));
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "Unable to run batch payout.");
    }
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-8 shadow-card lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="vp-eyebrow">Advanced tools</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink-heading">Move and manage funds on Arc</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-body">
            Bridge funding, stablecoin swaps, and batch payouts are being prepared for VeloxPay power users.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/wallet">Back to wallet</Link>
        </Button>
      </section>

      {error ? <Card className="border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Bridge USDC to Arc</h2>
          <p className="mt-2 text-sm text-ink-body">
            Estimate a USDC funding route into Arc before moving funds.
          </p>
          <form onSubmit={handleBridgeQuote} className="mt-4 space-y-4">
            <input
              value={bridgeForm.fromChain}
              onChange={(event) => setBridgeForm((current) => ({ ...current, fromChain: event.target.value }))}
              className="vp-control"
              aria-label="Source chain"
            />
            <input
              value={bridgeForm.amount}
              onChange={(event) => setBridgeForm((current) => ({ ...current, amount: event.target.value }))}
              className="vp-control"
              aria-label="Bridge amount"
            />
            <Button type="submit">Check bridge route</Button>
          </form>
          <div className="mt-5">
            <ResultCard title="Bridge status" result={bridgeQuote} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Swap stablecoins</h2>
          <p className="mt-2 text-sm text-ink-body">
            Prepare a stablecoin swap quote for Arc balances.
          </p>
          <form onSubmit={handleSwapQuote} className="mt-4 space-y-4">
            <select
              value={swapForm.fromToken}
              onChange={(event) => setSwapForm((current) => ({ ...current, fromToken: event.target.value }))}
              className="vp-control"
              aria-label="Source token"
            >
              <option value="EURC">EURC</option>
              <option value="USDC">USDC</option>
            </select>
            <select
              value={swapForm.toToken}
              onChange={(event) => setSwapForm((current) => ({ ...current, toToken: event.target.value }))}
              className="vp-control"
              aria-label="Destination token"
            >
              <option value="USDC">USDC</option>
              <option value="EURC">EURC</option>
            </select>
            <input
              value={swapForm.amount}
              onChange={(event) => setSwapForm((current) => ({ ...current, amount: event.target.value }))}
              className="vp-control"
              aria-label="Swap amount"
            />
            <Button type="submit">Check swap route</Button>
          </form>
          <div className="mt-5">
            <ResultCard title="Swap status" result={swapQuote} />
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-lg font-semibold">Batch payouts</h2>
        <p className="mt-2 text-sm text-ink-body">
          Enter one transfer per line as recipient, amount, token, memo. Local Arc wallets use one native Multicall3From batch transaction; Circle wallets use the compatible transfer route.
        </p>
        <form onSubmit={handleBatchSubmit} className="mt-4 space-y-4">
          <textarea
            value={batchRows}
            onChange={(event) => setBatchRows(event.target.value)}
            rows={5}
            placeholder="0xrecipient,1.00,USDC,Invoice payout"
            className="vp-control font-mono"
            aria-label="Batch transfers"
          />
          <Button type="submit" disabled={batchTransfers.length === 0}>Run batch payout</Button>
        </form>
        <div className="mt-5">
          <ResultCard title="Batch payout status" result={batchResult} />
        </div>
      </Card>
    </main>
  );
}
