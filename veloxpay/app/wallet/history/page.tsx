"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletRequiredState } from "@/components/wallet/wallet-required-state";
import { useVeloxPayData } from "@/components/wallet/use-veloxpay-data";
import { formatDate, formatMoney } from "@/lib/utils/format";

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "";
}

function shortHash(hash?: string) {
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : "-";
}

export default function WalletHistoryPage() {
  const { walletUser, transactions, errors, refreshTransactions } = useVeloxPayData({
    includeTransactions: true,
  });

  if (!walletUser) {
    return <WalletRequiredState />;
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">Wallet history</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Activity history</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={refreshTransactions}>Refresh</Button>
          <Button asChild variant="secondary">
            <Link href="/wallet">Back to wallet</Link>
          </Button>
        </div>
      </div>

      {errors.transactions ? (
        <Card className="border border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{errors.transactions}</p>
        </Card>
      ) : null}

      <Card>
        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
            No wallet activity yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-3 pr-6 font-medium">Hash</th>
                  <th className="py-3 pr-6 font-medium">Direction</th>
                  <th className="py-3 pr-6 font-medium">Amount</th>
                  <th className="py-3 pr-6 font-medium">Counterparty</th>
                  <th className="py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isIncoming = tx.to?.toLowerCase() === walletUser.address.toLowerCase();
                  const counterparty = isIncoming ? tx.from : tx.to;
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
                      <td className="py-4 pr-6">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isIncoming ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                          {isIncoming ? "Incoming" : "Outgoing"}
                        </span>
                      </td>
                      <td className="py-4 pr-6 text-slate-700">
                        {formatMoney(tx.amount, (tx.symbol || tx.token || "USDC").toUpperCase())}
                      </td>
                      <td className="py-4 pr-6 font-mono text-xs text-slate-500">{shortAddress(counterparty)}</td>
                      <td className="py-4 text-slate-500">{formatDate(tx.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
