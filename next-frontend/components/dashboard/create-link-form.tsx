"use client";

import { useActionState, useEffect, useState } from "react";
import { createPaymentLinkAction, type CreateLinkActionState } from "@/app/create/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

const initialState: CreateLinkActionState = {
  status: "idle",
};

const OWNER_EMAIL_KEY = "veloxpay_owner_email";
const OWNER_NAME_KEY = "veloxpay_owner_name";

export function CreateLinkForm({ compact = false }: { compact?: boolean }) {
  const [state, formAction, isPending] = useActionState(createPaymentLinkAction, initialState);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");

  useEffect(() => {
    setOwnerEmail(localStorage.getItem(OWNER_EMAIL_KEY) || "");
    setOwnerName(localStorage.getItem(OWNER_NAME_KEY) || "");
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      if (ownerEmail) {
        localStorage.setItem(OWNER_EMAIL_KEY, ownerEmail);
      }

      if (ownerName) {
        localStorage.setItem(OWNER_NAME_KEY, ownerName);
      }
    }
  }, [ownerEmail, ownerName, state.status]);

  return (
    <Card className={compact ? "" : "max-w-2xl"}>
      <h2 className="text-xl font-semibold text-slate-900">Create a payment link</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add your wallet email once and we&apos;ll remember it here for the next link you make.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        <Field
          label="Wallet email"
          hint="Use the same email you used to create or restore your wallet."
        >
          <input
            name="ownerEmail"
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
            name="ownerName"
            type="text"
            placeholder="Smart"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>

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
            <p className="mt-2 break-all font-medium text-slate-800">{state.url}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
