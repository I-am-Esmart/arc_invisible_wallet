"use client";

import { useActionState } from "react";
import { createPaymentLinkAction, type CreateLinkActionState } from "@/app/create/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

const initialState: CreateLinkActionState = {
  status: "idle",
};

export function CreateLinkForm({ compact = false }: { compact?: boolean }) {
  const [state, formAction, isPending] = useActionState(createPaymentLinkAction, initialState);

  return (
    <Card className={compact ? "" : "max-w-2xl"}>
      <h2 className="text-xl font-semibold text-slate-900">Create a payment link</h2>
      <p className="mt-2 text-sm text-slate-600">
        Keep it simple for the payer. Add an amount if you want a fixed request.
      </p>

      <form action={formAction} className="mt-6 space-y-5">
        <Field
          label="Amount"
          hint="Optional. Leave blank if you want the backend to decide or if the amount is flexible."
        >
          <input
            name="amount"
            type="text"
            placeholder="500"
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
