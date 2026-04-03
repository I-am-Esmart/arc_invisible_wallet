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
  action: (state: PayActionState) => Promise<PayActionState>;
  username: string;
}) {
  const [state, formAction, isPending] = useActionState(
    async (prevState: PayActionState) => action(prevState),
    initialState,
  );

  return (
    <div>
      <form action={formAction}>
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
