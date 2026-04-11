"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FaucetInstructionsModal } from "@/components/wallet/faucet-instructions-modal";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { formatDate, formatMoney } from "@/lib/utils/format";

function formatBalance(balance: string) {
  const value = Number(balance);
  return Number.isFinite(value) ? value.toFixed(2) : balance;
}

function shortAddress(address: string) {
  return address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "";
}

function shortHash(hash: string) {
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : "-";
}

export default function WalletPage() {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showFaucet, setShowFaucet] = useState(false);
  const { walletUser, balances, transactions, errors, loading, refreshBalances, refreshTransactions } = useVeloxPayData({
    includeBalances: true,
    includeTransactions: true,
  });

  if (!walletUser) {
    return <WalletRequiredState />;
  }

  async function handleCopyAddress() {
    if (!walletUser?.address) {
      return;
    }

    await navigator.clipboard.writeText(walletUser.address);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 1500);
  }

  return (
    <main className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Wallet</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your wallet in one place</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Check balances, copy your address, fund with faucet tokens, and keep an eye on recent activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setShowFaucet(true)}>Get faucet</Button>
          <Button asChild variant="secondary">
            <Link href="/wallet/receive">Receive</Link>
          </Button>
          <Button asChild>
            <Link href="/wallet/send">Send</Link>
          </Button>
        </div>
      </section>

      {(errors.balances || errors.transactions) ? (
        <Card className="border border-amber-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-amber-900">Some wallet data is unavailable right now</h2>
          <div className="mt-2 space-y-1 text-sm text-amber-800">
            {errors.balances ? <p>{errors.balances}</p> : null}
            {errors.transactions ? <p>{errors.transactions}</p> : null}
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <div className="text-sm text-slate-500">USDC balance</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">
            {loading ? "..." : formatBalance(balances.USDC?.balance || "0")} USDC
          </div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">EURC balance</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">
            {loading ? "..." : formatBalance(balances.EURC?.balance || "0")} EURC
          </div>
        </Card>
        <Card className="bg-slate-950 text-white">
          <div className="text-sm text-white/60">Wallet address</div>
          <div className="mt-2 break-all font-mono text-sm">{walletUser.address}</div>
          <button
            onClick={handleCopyAddress}
            className="mt-4 inline-flex items-center rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            {copiedAddress ? "Copied" : `Copy ${shortAddress(walletUser.address)}`}
          </button>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Receive</h2>
          <p className="mt-2 text-sm text-slate-600">
            Share your wallet address directly or use the QR code below.
          </p>
          <div className="mt-6 flex justify-center rounded-3xl bg-slate-50 p-6">
            <QRCodeCanvas value={walletUser.address} size={220} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Wallet address</div>
            <div className="mt-2 break-all font-mono text-sm text-slate-800">{walletUser.address}</div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent wallet activity</h2>
              <p className="mt-1 text-sm text-slate-600">
                Recent on-chain USDC and EURC transfers for this wallet.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={refreshBalances}>Refresh balances</Button>
              <Button variant="secondary" onClick={refreshTransactions}>Refresh activity</Button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
              No wallet activity yet.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="py-3 pr-6 font-medium">Hash</th>
                    <th className="py-3 pr-6 font-medium">Amount</th>
                    <th className="py-3 pr-6 font-medium">Counterparty</th>
                    <th className="py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.slice(0, 8).map((tx) => {
                    const counterparty = tx.to?.toLowerCase() === walletUser.address.toLowerCase() ? tx.from : tx.to;
                    const explorerUrl = tx.explorerUrl || tx.explorer;

                    return (
                      <tr key={`${tx.hash}-${tx.symbol || tx.token || "token"}`}>
                        <td className="py-4 pr-6 text-slate-700">
                          {explorerUrl ? (
                            <a href={explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-brand-600 hover:underline">
                              {shortHash(tx.hash)}
                            </a>
                          ) : (
                            <span className="font-mono text-xs">{shortHash(tx.hash)}</span>
                          )}
                        </td>
                        <td className="py-4 pr-6 text-slate-700">{formatMoney(tx.amount, (tx.symbol || tx.token || "USDC").toUpperCase())}</td>
                        <td className="py-4 pr-6 font-mono text-xs text-slate-500">{shortAddress(counterparty)}</td>
                        <td className="py-4 text-slate-500">{formatDate(tx.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5">
            <Button asChild variant="ghost">
              <Link href="/wallet/history">View full history</Link>
            </Button>
          </div>
        </Card>
      </section>

      <FaucetInstructionsModal open={showFaucet} onClose={() => setShowFaucet(false)} />
    </main>
  );
}
