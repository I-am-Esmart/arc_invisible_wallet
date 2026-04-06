"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PaymentStatus } from "./payment-status";
import type { PayActionState } from "@/app/[username]/[amount]/actions";

const initialState: PayActionState = {
  status: "idle",
};

export function PayButton({
  action,
  username,
}: {
  action: (state: PayActionState, formData: FormData) => Promise<PayActionState>;
  username: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Your email</span>
          <input
            type="email"
            name="payerEmail"
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            required
          />
        </label>

        <Button type="submit" className="w-full py-3 text-base" disabled={isPending}>
          {isPending ? "Processing..." : `Pay ${username}`}
        </Button>
      </form>
      <PaymentStatus
        status={state.status}
        message={state.message}
        transactionHash={state.transactionHash}
      />
    </div>
  );
}
