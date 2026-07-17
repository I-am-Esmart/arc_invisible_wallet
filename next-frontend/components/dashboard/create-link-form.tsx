"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPaymentLinkAction, type CreateLinkActionState } from "@/app/create/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { upsertStoredPaymentLink } from "@/lib/session/payment-links";
import type { SavedCustomer } from "@/lib/types/customer";
import type { WalletUser } from "@/lib/types/wallet";

const initialState: CreateLinkActionState = {
  status: "idle",
};

const OWNER_EMAIL_KEY = "veloxpay_owner_email";
const OWNER_NAME_KEY = "veloxpay_owner_name";

export function CreateLinkForm({
  compact = false,
  walletUser,
  customers = [],
  onCreated,
}: {
  compact?: boolean;
  walletUser?: WalletUser | null;
  customers?: SavedCustomer[];
  onCreated?: (paymentLink?: CreateLinkActionState["paymentLink"]) => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createPaymentLinkAction, initialState);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [currency, setCurrency] = useState("USDC");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [recurrence, setRecurrence] = useState("one-time");
  const [copied, setCopied] = useState(false);

  function syncOwnerCookies(email: string, name: string) {
    if (!email) {
      return;
    }

    document.cookie = `veloxpay_owner_email=${encodeURIComponent(email)}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `veloxpay_owner_name=${encodeURIComponent(name || "")}; path=/; max-age=31536000; samesite=lax`;
  }

  useEffect(() => {
    if (walletUser?.email) {
      const nextName = walletUser.displayName || "";
      setOwnerEmail(walletUser.email);
      setOwnerName(nextName);
      localStorage.setItem(OWNER_EMAIL_KEY, walletUser.email);
      localStorage.setItem(OWNER_NAME_KEY, nextName);
      syncOwnerCookies(walletUser.email, nextName);
      if (compact) {
        router.refresh();
      }
      return;
    }

    const savedEmail = localStorage.getItem(OWNER_EMAIL_KEY) || "";
    const savedName = localStorage.getItem(OWNER_NAME_KEY) || "";
    setOwnerEmail(savedEmail);
    setOwnerName(savedName);

    if (savedEmail) {
      syncOwnerCookies(savedEmail, savedName);
      if (compact) {
        router.refresh();
      }
    }
  }, [compact, router, walletUser]);

  useEffect(() => {
    if (state.status === "success") {
      if (ownerEmail) {
        localStorage.setItem(OWNER_EMAIL_KEY, ownerEmail);
        syncOwnerCookies(ownerEmail, ownerName);
        if (state.paymentLink) {
          upsertStoredPaymentLink(ownerEmail, state.paymentLink);
        }
      }

      if (ownerName) {
        localStorage.setItem(OWNER_NAME_KEY, ownerName);
      }

      setCopied(false);
      router.refresh();
      onCreated?.(state.paymentLink);
    }
  }, [compact, onCreated, ownerEmail, ownerName, router, state.paymentLink, state.status]);

  async function handleCopyLink() {
    if (!state.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className={compact ? "" : "max-w-2xl"}>
      <h2 className="text-xl font-semibold text-slate-900">Create a payment request</h2>
      <p className="mt-2 text-sm text-slate-600">
        {walletUser?.email
          ? "Your wallet is already connected, so you can create an invoice-style payment request in seconds."
          : "Add your wallet email once and we&apos;ll remember it here for the next payment request you create."}
      </p>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Use this when you want to charge a client, collect for a service, request a deposit, or share a simple pay-me link.
      </div>

      {customers.length ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">Recent customers</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {customers.slice(0, 6).map((customer) => (
              <button
                key={customer.email}
                type="button"
                onClick={() => {
                  setCustomerEmail(customer.email);
                  setCustomerName(customer.name || "");
                }}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
              >
                {customer.name || customer.email}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form action={formAction} className="mt-6 space-y-5">
        <input name="ownerEmail" type="hidden" value={ownerEmail} />
        <input name="ownerName" type="hidden" value={ownerName} />
        <input name="walletSessionToken" type="hidden" value={walletUser?.sessionToken || ""} />

        {walletUser?.email ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">
              Creating payment requests as {ownerName || walletUser.email}
            </div>
            <div className="mt-1 text-sm text-slate-500">{ownerEmail}</div>
          </div>
        ) : (
          <>
            <Field
              label="Wallet email"
              hint="Use the same email you used to create or restore your wallet."
            >
              <input
                name="ownerEmailVisible"
                type="email"
                placeholder="you@example.com"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>

            <Field
              label="Name"
              hint="We&apos;ll show this on the payment request so people know who they&apos;re paying."
            >
              <input
                name="ownerNameVisible"
                type="text"
                placeholder="Smart"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
          </>
        )}

        <Field
          label="Amount"
          hint="Required. This is the amount the payer will see right away."
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <input
              name="amount"
              type="text"
              placeholder="500"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="USDC">USDC on Arc</option>
              <option value="EURC">EURC on Arc</option>
            </select>
          </div>
        </Field>

        <Field label="Description" hint="Optional. Tell the payer exactly what this request is for.">
          <textarea
            name="description"
            rows={4}
            placeholder="Website design invoice"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Customer email" hint="Optional. Save a specific customer on this request for faster follow-up.">
            <input
              name="customerEmail"
              type="email"
              placeholder="client@example.com"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="Customer name" hint="Optional. Helpful for retainers, subscriptions, or named invoices.">
            <input
              name="customerName"
              type="text"
              placeholder="Acme team"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>
        </div>

        <Field label="Billing cadence" hint="Recurring requests stay reusable for weekly or monthly collections.">
          <select
            name="recurrence"
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="one-time">One-time request</option>
            <option value="weekly">Weekly recurring request</option>
            <option value="monthly">Monthly recurring request</option>
          </select>
        </Field>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create payment request"}
        </Button>
      </form>

      {state.message ? (
        <div
          className={`mt-5 rounded-2xl p-4 text-sm ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-800 dark:border dark:border-emerald-800/50 dark:bg-emerald-950/70 dark:text-emerald-100"
              : "bg-rose-50 text-rose-700 dark:border dark:border-rose-800/50 dark:bg-rose-950/70 dark:text-rose-100"
          }`}
        >
          <p>{state.message}</p>
          {state.url ? (
            <>
              <p className="mt-2 text-sm">
                Your request is ready. Send this link to the person who should pay you.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <p className="min-w-0 flex-1 break-all font-medium text-slate-800 dark:text-emerald-50">{state.url}</p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-white dark:ring-emerald-700 dark:hover:bg-slate-900"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800/70">
                What happens next: the payer opens the link, sees who they are paying, confirms the amount, and completes the payment from one page.
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
