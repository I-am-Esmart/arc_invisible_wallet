"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { PaymentLinksTable } from "@/components/dashboard/payment-links-table";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWalletBalances, fetchWalletTransactions, sendWalletTransaction } from "@/lib/api/wallet";
import { listPaymentLinks } from "@/lib/api/payment-links";
import { listPayments } from "@/lib/api/payments";
import { clearWalletUser, getStoredWalletUser } from "@/lib/session/wallet";
import type { PaymentLink } from "@/lib/types/payment-link";
import type { Payment } from "@/lib/types/payment";
import type { WalletBalances, WalletTransaction, WalletUser } from "@/lib/types/wallet";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { FaucetInstructionsModal } from "./faucet-instructions-modal";

const TOKEN_OPTIONS = [
  { value: "USDC", label: "USDC" },
  { value: "EURC", label: "EURC" },
] as const;

function formatBalance(balance: string) {
  const value = Number(balance);
  return Number.isFinite(value) ? value.toFixed(2) : balance;
}

function shortAddress(address: string) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function shortHash(hash?: string) {
  if (!hash) {
    return "-";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function WalletWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [walletUser, setWalletUser] = useState<WalletUser | null>(null);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<(typeof TOKEN_OPTIONS)[number]["value"]>("USDC");
  const [sending, setSending] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showFaucet, setShowFaucet] = useState(false);

  const returnTo = searchParams.get("returnTo");

  const refreshWorkspace = useCallback(async (user: WalletUser) => {
    const [walletBalances, walletTxs, nextLinks, nextPayments] = await Promise.all([
      fetchWalletBalances(user.address),
      fetchWalletTransactions(user.address),
      listPaymentLinks(user.email),
      listPayments(user.email),
    ]);

    setBalances(walletBalances.balances || {});
    setTransactions(walletTxs.txs || []);
    setPaymentLinks(nextLinks);
    setPayments(nextPayments);
  }, []);

  useEffect(() => {
    const user = getStoredWalletUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setWalletUser(user);

    refreshWorkspace(user)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load your workspace.");
      })
      .finally(() => setLoading(false));
  }, [refreshWorkspace]);

  const totalLinks = paymentLinks.length;
  const totalPayments = payments.filter((payment) => payment.status === "completed").length;

  const balanceCards = useMemo(
    () => TOKEN_OPTIONS.map((entry) => ({
      ...entry,
      balance: balances?.[entry.value]?.balance || "0",
    })),
    [balances],
  );

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!walletUser) {
      return;
    }

    try {
      setSending(true);
      setSendError("");
      setSendSuccess("");

      const response = await sendWalletTransaction({
        to: recipientAddress,
        amount,
        token,
        email: walletUser.email,
        arcKeyId: walletUser.arcKeyId,
      });

      setSendSuccess(`Sent ${response.amount} ${response.symbol}.`);
      setRecipientAddress("");
      setAmount("");
      await refreshWorkspace(walletUser);
    } catch (sendTxError) {
      setSendError(sendTxError instanceof Error ? sendTxError.message : "Unable to send payment.");
    } finally {
      setSending(false);
    }
  }

  function handleLogout() {
    clearWalletUser();
    router.push("/");
    router.refresh();
  }

  async function handleCopyAddress() {
    if (!walletUser?.address) {
      return;
    }

    await navigator.clipboard.writeText(walletUser.address);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 1500);
  }

  if (!walletUser) {
    return (
      <main className="space-y-8">
        <section className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_45%,_#eef5ff)] p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
          <p className="inline-flex rounded-full bg-brand-50 px-4 py-1 text-sm font-medium uppercase tracking-[0.18em] text-brand-700">
            Wallet required
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Create or restore your VeloxPay wallet to unlock the full experience.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            One wallet gives you balances, send and receive, activity history, and payment links in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/login">Create or restore wallet</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <section className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_45%,_#eef5ff)] p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex rounded-full bg-brand-50 px-4 py-1 text-sm font-medium uppercase tracking-[0.18em] text-brand-700">
              VeloxPay workspace
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Welcome back, {walletUser.displayName || walletUser.username || "there"}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Your wallet, payment links, and incoming payments now live in one dashboard. Fund your wallet, share a link, and track everything without hopping between apps.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setShowFaucet(true)}>
              Get faucet
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>

        {returnTo ? (
          <div className="mt-8 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700 ring-1 ring-blue-100">
            Your wallet is ready. If you&apos;ve funded it, head back and finish the payment.
            <a href={returnTo} className="ml-2 font-semibold underline">
              Return to payment
            </a>
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {balanceCards.map((entry) => (
            <Card key={entry.value} className="bg-white/90">
              <div className="text-sm text-slate-500">{entry.label} balance</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">
                {loading ? "..." : formatBalance(entry.balance)}
              </div>
              <div className="mt-1 text-sm text-slate-500">{entry.label}</div>
            </Card>
          ))}
          <Card className="bg-slate-950 text-white">
            <div className="text-sm text-white/60">Wallet address</div>
            <div className="mt-2 break-all font-mono text-sm">{walletUser.address}</div>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="mt-4 inline-flex items-center rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              {copiedAddress ? "Copied" : `Copy ${shortAddress(walletUser.address)}`}
            </button>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Send from your wallet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Move USDC or EURC directly from the same wallet that powers your payment links.
          </p>

          <form onSubmit={handleSend} className="mt-6 space-y-4">
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
                value={recipientAddress}
                onChange={(event) => setRecipientAddress(event.target.value)}
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

            {sendError ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{sendError}</div>
            ) : null}

            {sendSuccess ? (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{sendSuccess}</div>
            ) : null}

            <Button type="submit" className="w-full py-3 text-base" disabled={sending}>
              {sending ? "Sending..." : `Send ${token}`}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Receive into your wallet</h2>
              <p className="mt-2 text-sm text-slate-600">
                Share your address directly or collect through a payment link below.
              </p>
            </div>
            <button
              onClick={handleCopyAddress}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              {copiedAddress ? "Copied" : "Copy address"}
            </button>
          </div>

          <div className="mt-6 flex justify-center rounded-3xl bg-slate-50 p-6">
            <QRCodeCanvas value={walletUser.address} size={220} bgColor="#ffffff" fgColor="#0f172a" />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Wallet address</div>
            <div className="mt-2 break-all font-mono text-sm text-slate-800">{walletUser.address}</div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <CreateLinkForm compact walletUser={walletUser} onCreated={() => refreshWorkspace(walletUser)} />

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Quick stats</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Links created</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{totalLinks}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Payments tracked</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{totalPayments}</div>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
            <div className="text-sm text-white/60">Connected wallet</div>
            <div className="mt-2 break-all font-mono text-sm">{walletUser.email}</div>
            <div className="mt-4 text-sm text-white/70">
              This single wallet identity now powers your send, receive, payment-link, and payment history flows.
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6">
        <PaymentLinksTable paymentLinks={paymentLinks} />
        <PaymentsTable payments={payments} />
      </section>

      <section>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Wallet activity</h2>
              <p className="mt-1 text-sm text-slate-600">
                Recent on-chain USDC and EURC transfers for this wallet.
              </p>
            </div>
            <Button variant="secondary" onClick={() => walletUser && refreshWorkspace(walletUser)}>
              Refresh activity
            </Button>
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
                    <th className="py-3 pr-6 font-medium">Direction</th>
                    <th className="py-3 pr-6 font-medium">Amount</th>
                    <th className="py-3 pr-6 font-medium">Counterparty</th>
                    <th className="py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isIncoming = tx.to?.toLowerCase() === walletUser.address.toLowerCase();
                    const explorerUrl = tx.explorerUrl || tx.explorer;
                    const counterparty = isIncoming ? tx.from : tx.to;

                    return (
                      <tr key={`${tx.hash}-${tx.symbol || tx.token || "token"}`}>
                        <td className="py-4 pr-6 text-slate-700">
                          {explorerUrl ? (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-xs text-brand-600 hover:underline"
                            >
                              {shortHash(tx.hash)}
                            </a>
                          ) : (
                            <span className="font-mono text-xs">{shortHash(tx.hash)}</span>
                          )}
                        </td>
                        <td className="py-4 pr-6 text-slate-700">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              isIncoming
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
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
      </section>

      <FaucetInstructionsModal open={showFaucet} onClose={() => setShowFaucet(false)} />
    </main>
  );
}
