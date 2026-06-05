"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import {
  createUserControlledWalletSession,
  fetchCustodyOptions,
  fetchFeatureCapabilities,
  fetchSettlementReport,
  fetchUnifiedBalance,
  quoteBridge,
  quoteSwap,
  sendBatchTransfers,
} from "@/lib/api/features";
import type { FeatureCapabilities, FeatureStatus } from "@/lib/types/features";

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

function StatusBlock({ title, data }: { title: string; data: FeatureStatus | null }) {
  if (!data) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
      <div className="font-semibold text-slate-900">{title}</div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function FeaturesPage() {
  const { walletUser } = useVeloxPayData({ includeBalances: false });
  const [capabilities, setCapabilities] = useState<FeatureCapabilities | null>(null);
  const [custody, setCustody] = useState<FeatureStatus | null>(null);
  const [unifiedBalance, setUnifiedBalance] = useState<FeatureStatus | null>(null);
  const [bridgeForm, setBridgeForm] = useState(EMPTY_BRIDGE);
  const [swapForm, setSwapForm] = useState(EMPTY_SWAP);
  const [batchRows, setBatchRows] = useState("");
  const [bridgeQuote, setBridgeQuote] = useState<FeatureStatus | null>(null);
  const [swapQuote, setSwapQuote] = useState<FeatureStatus | null>(null);
  const [batchResult, setBatchResult] = useState<FeatureStatus | null>(null);
  const [userWalletSession, setUserWalletSession] = useState<FeatureStatus | null>(null);
  const [settlementReport, setSettlementReport] = useState<FeatureStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [featuresResult, custodyResult] = await Promise.all([
          fetchFeatureCapabilities(),
          fetchCustodyOptions(),
        ]);
        setCapabilities(featuresResult);
        setCustody(custodyResult);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load Arc features.");
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!walletUser?.address) {
      return;
    }

    fetchUnifiedBalance(walletUser.address)
      .then(setUnifiedBalance)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load unified balance.");
      });
  }, [walletUser?.address]);

  const batchTransfers = useMemo(
    () =>
      batchRows
        .split("\n")
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
          const [to, amount, token = "USDC"] = row.split(",").map((value) => value.trim());
          return { to, amount, token };
        }),
    [batchRows],
  );

  if (!walletUser) {
    return <WalletRequiredState title="Create your wallet before using advanced Arc features" />;
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

  async function handleUserWalletSession() {
    if (!walletUser) {
      return;
    }

    setError("");
    try {
      setUserWalletSession(await createUserControlledWalletSession(walletUser.email));
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Unable to prepare user-controlled session.");
    }
  }

  async function handleSettlementReport() {
    if (!walletUser) {
      return;
    }

    setError("");
    try {
      setSettlementReport(await fetchSettlementReport(walletUser.email));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Unable to generate settlement report.");
    }
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Arc features</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Stablecoin rails for the next VeloxPay release</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Manage Circle wallet custody, gasless Arc payments, cross-chain USDC funding, unified balance, swaps, batch payouts, and settlement reporting.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/wallet">Back to wallet</Link>
        </Button>
      </section>

      {error ? <Card className="border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-slate-500">Network</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{capabilities?.network.name || "Arc Testnet"}</div>
          <p className="mt-2 text-sm text-slate-600">Gas is displayed in {capabilities?.network.gasToken || "USDC"}.</p>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Finality</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">Sub-second</div>
          <p className="mt-2 text-sm text-slate-600">A single Arc confirmation is treated as final settlement.</p>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Developer wallets</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{capabilities?.wallets.developerControlled ? "On" : "Setup"}</div>
          <p className="mt-2 text-sm text-slate-600">{walletUser.custodyType || "circle-developer-controlled"}</p>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Gasless mode</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{capabilities?.wallets.gasStation ? "Ready" : "USDC gas"}</div>
          <p className="mt-2 text-sm text-slate-600">{walletUser.gasMode || "usdc-native"}</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Circle wallet custody</h2>
          <p className="mt-2 text-sm text-slate-600">
            VeloxPay can run invisible merchant flows with developer-controlled wallets and expose a user-controlled path for direct user approval.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={handleUserWalletSession}>Prepare user-controlled session</Button>
            <Button type="button" variant="secondary" onClick={handleSettlementReport}>Generate settlement report</Button>
          </div>
          <div className="mt-5 space-y-4">
            <StatusBlock title="Custody options" data={custody} />
            <StatusBlock title="User-controlled session" data={userWalletSession} />
            <StatusBlock title="Settlement report" data={settlementReport} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Unified Balance</h2>
          <p className="mt-2 text-sm text-slate-600">
            Start with the user&apos;s Arc USDC balance and extend to Circle Gateway/App Kit when cross-chain sources are configured.
          </p>
          <div className="mt-5">
            <StatusBlock title="Unified balance" data={unifiedBalance} />
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Bridge USDC to Arc</h2>
          <form onSubmit={handleBridgeQuote} className="mt-4 space-y-4">
            <input
              value={bridgeForm.fromChain}
              onChange={(event) => setBridgeForm((current) => ({ ...current, fromChain: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              aria-label="Source chain"
            />
            <input
              value={bridgeForm.amount}
              onChange={(event) => setBridgeForm((current) => ({ ...current, amount: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              aria-label="Bridge amount"
            />
            <Button type="submit">Quote bridge</Button>
          </form>
          <div className="mt-5">
            <StatusBlock title="Bridge quote" data={bridgeQuote} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Swap stablecoins</h2>
          <form onSubmit={handleSwapQuote} className="mt-4 space-y-4">
            <select
              value={swapForm.fromToken}
              onChange={(event) => setSwapForm((current) => ({ ...current, fromToken: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              aria-label="Source token"
            >
              <option value="EURC">EURC</option>
              <option value="USDC">USDC</option>
            </select>
            <select
              value={swapForm.toToken}
              onChange={(event) => setSwapForm((current) => ({ ...current, toToken: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              aria-label="Destination token"
            >
              <option value="USDC">USDC</option>
              <option value="EURC">EURC</option>
            </select>
            <input
              value={swapForm.amount}
              onChange={(event) => setSwapForm((current) => ({ ...current, amount: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              aria-label="Swap amount"
            />
            <Button type="submit">Quote swap</Button>
          </form>
          <div className="mt-5">
            <StatusBlock title="Swap quote" data={swapQuote} />
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Batch payouts</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter one transfer per line as recipient, amount, token. This uses the same Arc/Circle execution path as regular sends.
        </p>
        <form onSubmit={handleBatchSubmit} className="mt-4 space-y-4">
          <textarea
            value={batchRows}
            onChange={(event) => setBatchRows(event.target.value)}
            rows={5}
            placeholder="0xrecipient,1.00,USDC"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-sm"
            aria-label="Batch transfers"
          />
          <Button type="submit" disabled={batchTransfers.length === 0}>Run batch payout</Button>
        </form>
        <div className="mt-5">
          <StatusBlock title="Batch result" data={batchResult} />
        </div>
      </Card>
    </main>
  );
}
