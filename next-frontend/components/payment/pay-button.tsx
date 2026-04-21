"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PaymentStatus } from "./payment-status";
import type { PayActionState } from "@/app/[username]/[amount]/actions";

const initialState: PayActionState = {
  status: "idle",
};

export function PayButton({
  action,
  username,
  linkToken,
}: {
  action: (state: PayActionState, formData: FormData) => Promise<PayActionState>;
  username: string;
  linkToken?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [payerEmail, setPayerEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (state.payerEmail) {
      setPayerEmail(state.payerEmail);
    }

    if (state.status === "success") {
      setVerificationCode("");
    }
  }, [state]);

  const waitingForCode = state.status === "code_sent" || Boolean(state.challengeId);

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="challengeId" value={state.challengeId || ""} />
        <input type="hidden" name="linkToken" value={linkToken || ""} />

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Your email</span>
          <input
            type="email"
            name="payerEmail"
            placeholder="you@example.com"
            value={payerEmail}
            onChange={(event) => setPayerEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            required
          />
        </label>

        {waitingForCode ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Verification code</span>
            <input
              type="text"
              name="verificationCode"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        ) : (
          <p className="text-sm leading-6 text-slate-500">
            We&apos;ll send a one-time code to confirm this payment before anything moves.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          {waitingForCode ? (
            <>
              <Button
                type="submit"
                className="w-full py-3 text-base"
                disabled={isPending}
                name="intent"
                value="confirm-payment"
              >
                {isPending ? "Verifying..." : `Verify and pay ${username}`}
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className="w-full py-3 text-base"
                disabled={isPending}
                name="intent"
                value="send-code"
              >
                Send a new code
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              className="w-full py-3 text-base"
              disabled={isPending}
              name="intent"
              value="send-code"
            >
              {isPending ? "Sending code..." : `Verify before paying ${username}`}
            </Button>
          )}
        </div>
      </form>

      <PaymentStatus
        status={state.status}
        message={state.message}
        transactionHash={state.transactionHash}
        explorerUrl={state.explorerUrl}
        createWalletUrl={state.createWalletUrl}
      />
    </div>
  );
}
