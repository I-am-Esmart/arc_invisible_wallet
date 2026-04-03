"use client";

import { Button } from "@/components/ui/button";

export default function PaymentLinkError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-semibold text-slate-900">Unable to load payment link</h1>
      <p className="mt-3 text-sm text-slate-600">{error.message}</p>
      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
