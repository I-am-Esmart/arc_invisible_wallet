"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateLinkForm } from "@/components/dashboard/create-link-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStoredWalletUser } from "@/lib/session/wallet";
import type { WalletUser } from "@/lib/types/wallet";

export default function CreatePage() {
  const [walletUser, setWalletUser] = useState<WalletUser | null>(null);

  useEffect(() => {
    setWalletUser(getStoredWalletUser());
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">
            Create payment link
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Generate a shareable link from your VeloxPay wallet
          </h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {walletUser ? (
        <CreateLinkForm walletUser={walletUser} />
      ) : (
        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Create your wallet first</h2>
          <p className="mt-2 text-sm text-slate-600">
            Payment links now live inside the same VeloxPay wallet experience, so sign in once and create links from your connected account.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/login">Create or restore wallet</Link>
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}
