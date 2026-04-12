"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { VeloxPayLogo } from "@/components/brand/veloxpay-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { checkBackend, loginWallet } from "@/lib/api/wallet";
import { getSavedWalletDisplayName, getStoredWalletUser, saveWalletUser } from "@/lib/session/wallet";
import { RestoreInstructionsModal } from "./restore-instructions-modal";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendError, setBackendError] = useState("");
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const returnTo = searchParams.get("returnTo");
  const source = searchParams.get("source");

  useEffect(() => {
    const user = getStoredWalletUser();
    if (user) {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const emailFromLink = searchParams.get("email");

    if (emailFromLink) {
      setEmail(emailFromLink);
    }

    setDisplayName(getSavedWalletDisplayName());
  }, [searchParams]);

  async function verifyBackend() {
    setCheckingBackend(true);

    try {
      await checkBackend();
      setBackendError("");
      return true;
    } catch (healthError) {
      setBackendError(
        healthError instanceof Error ? healthError.message : "Failed to reach the backend.",
      );
      return false;
    } finally {
      setCheckingBackend(false);
    }
  }

  useEffect(() => {
    verifyBackend();
  }, []);

  async function handleLogin() {
    setLoading(true);
    setError("");

    const healthy = await verifyBackend();
    if (!healthy) {
      setLoading(false);
      return;
    }

    try {
      const user = await loginWallet(email, displayName);
      saveWalletUser(user);

      if (returnTo) {
        router.push(`/dashboard?returnTo=${encodeURIComponent(returnTo)}`);
      } else {
        router.push("/dashboard");
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to create your wallet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md">
      <Card className="rounded-[2rem] p-8 sm:p-10">
        <div className="flex items-center gap-4">
          <VeloxPayLogo className="h-14 w-14" />
          <div>
            <p className="inline-flex rounded-full bg-brand-50 px-4 py-1 text-sm font-medium uppercase tracking-[0.18em] text-brand-700">
              VeloxPay wallet
            </p>
          </div>
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
          Create or restore your wallet
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          One email unlocks your wallet, balances, send and receive, activity history, and payment links.
        </p>

        {source === "veloxpay" ? (
          <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700 ring-1 ring-blue-100">
            Finish setting up your wallet here, then we&apos;ll take you back to complete the payment.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Your name</span>
            <input
              type="text"
              placeholder="Smart"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Your email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="mt-6">
          <Button onClick={handleLogin} disabled={loading} className="w-full py-3 text-base">
            {loading ? "Creating wallet..." : "Create / Restore wallet"}
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-slate-500">
          Use the same email again on any device and VeloxPay will bring back the same wallet.
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setShowInstructions(true)}
            className="cursor-pointer font-medium text-brand-600 hover:underline"
          >
            How it works
          </button>
          <span className="text-slate-300">•</span>
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            Back to home
          </Link>
        </div>

        {backendError ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            <div className="text-rose-600">{backendError}</div>
            <button
              onClick={verifyBackend}
              disabled={checkingBackend}
              className="mt-3 inline-flex items-center rounded-2xl bg-brand-100 px-3 py-2 font-medium text-brand-700 transition hover:bg-brand-200"
            >
              {checkingBackend ? "Retrying..." : "Retry connection"}
            </button>
          </div>
        ) : null}
      </Card>

      <RestoreInstructionsModal open={showInstructions} onClose={() => setShowInstructions(false)} />
    </main>
  );
}
