import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function WalletRequiredState({
  title = "Create or restore your wallet to continue",
  message = "VeloxPay keeps your wallet, payment links, and incoming payments together. Sign in once to unlock the full experience.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Card className="max-w-3xl">
      <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/login">Create or restore wallet</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </Card>
  );
}
