"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPaymentLinkAction, type CreateLinkActionState } from "@/app/create/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { upsertStoredPaymentLink } from "@/lib/session/payment-links";
import type { WalletUser } from "@/lib/types/wallet";

const initialState: CreateLinkActionState = {
  status: "idle",
};

const OWNER_EMAIL_KEY = "veloxpay_owner_email";
const OWNER_NAME_KEY = "veloxpay_owner_name";

export function CreateLinkForm({
  compact = false,
  walletUser,
  onCreated,
}: {
  compact?: boolean;
  walletUser?: WalletUser | null;
  onCreated?: (paymentLink?: CreateLinkActionState["paymentLink"]) => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createPaymentLinkAction, initialState);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
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
      <h2 className="text-xl font-semibold text-slate-900">Create a payment link</h2>
      <p className="mt-2 text-sm text-slate-600">
        {walletUser?.email
          ? "Your wallet is already connected, so you can generate a payment link in seconds."
          : "Add your wallet email once and we&apos;ll remember it here for the next link you make."}
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        <input name="ownerEmail" type="hidden" value={ownerEmail} />
        <input name="ownerName" type="hidden" value={ownerName} />

        {walletUser?.email ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">
              Creating as {ownerName || walletUser.email}
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
              hint="We&apos;ll show this on your payment page so people know who they&apos;re paying."
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
          hint="Required. We&apos;ll include a unique ID too, so similar links never clash."
        >
          <input
            name="amount"
            type="text"
            placeholder="500"
            required
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>

        <Field label="Description" hint="Optional. Keep it short and clear for the payer.">
          <textarea
            name="description"
            rows={4}
            placeholder="Website design invoice"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create payment link"}
        </Button>
      </form>

      {state.message ? (
        <div
          className={`mt-5 rounded-2xl p-4 text-sm ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          <p>{state.message}</p>
          {state.url ? (
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
              <p className="min-w-0 flex-1 break-all font-medium text-slate-800">{state.url}</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
