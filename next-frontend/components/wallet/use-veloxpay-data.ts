"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWalletBalances, fetchWalletTransactions, sendWalletTransaction } from "@/lib/api/wallet";
import { listPaymentLinks } from "@/lib/api/payment-links";
import { listPayments } from "@/lib/api/payments";
import { clearWalletUser, getStoredWalletUser } from "@/lib/session/wallet";
import type { PaymentLink } from "@/lib/types/payment-link";
import type { Payment } from "@/lib/types/payment";
import type { WalletBalances, WalletTransaction, WalletUser } from "@/lib/types/wallet";

type Options = {
  includeBalances?: boolean;
  includeTransactions?: boolean;
  includeLinks?: boolean;
  includePayments?: boolean;
};

type ErrorState = {
  balances: string;
  transactions: string;
  links: string;
  payments: string;
};

const EMPTY_ERRORS: ErrorState = {
  balances: "",
  transactions: "",
  links: "",
  payments: "",
};

export function useVeloxPayData(options: Options = {}) {
  const {
    includeBalances = true,
    includeTransactions = false,
    includeLinks = false,
    includePayments = false,
  } = options;

  const router = useRouter();
  const [walletUser, setWalletUser] = useState<WalletUser | null>(null);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<ErrorState>(EMPTY_ERRORS);

  const refreshData = useCallback(async (user: WalletUser) => {
    const nextErrors: ErrorState = { ...EMPTY_ERRORS };
    const tasks: Promise<void>[] = [];

    if (includeBalances) {
      tasks.push(
        fetchWalletBalances(user.address)
          .then((result) => setBalances(result.balances || {}))
          .catch((error) => {
            nextErrors.balances =
              error instanceof Error ? error.message : "Unable to load balances.";
          }),
      );
    }

    if (includeTransactions) {
      tasks.push(
        fetchWalletTransactions(user.address)
          .then((result) => setTransactions(result.txs || []))
          .catch((error) => {
            nextErrors.transactions =
              error instanceof Error ? error.message : "Unable to load wallet activity.";
          }),
      );
    }

    if (includeLinks) {
      tasks.push(
        listPaymentLinks(user.email)
          .then((result) => setPaymentLinks(result))
          .catch((error) => {
            nextErrors.links =
              error instanceof Error ? error.message : "Unable to load payment links.";
          }),
      );
    }

    if (includePayments) {
      tasks.push(
        listPayments(user.email)
          .then((result) => setPayments(result))
          .catch((error) => {
            nextErrors.payments =
              error instanceof Error ? error.message : "Unable to load payments.";
          }),
      );
    }

    await Promise.all(tasks);
    setErrors(nextErrors);
  }, [includeBalances, includeLinks, includePayments, includeTransactions]);

  useEffect(() => {
    const user = getStoredWalletUser();
    setWalletUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    refreshData(user).finally(() => setLoading(false));
  }, [refreshData]);

  const logout = useCallback(() => {
    clearWalletUser();
    setWalletUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const totals = useMemo(() => ({
    links: paymentLinks.length,
    completedPayments: payments.filter((payment) => payment.status === "completed").length,
  }), [paymentLinks, payments]);

  return {
    walletUser,
    balances,
    transactions,
    paymentLinks,
    payments,
    errors,
    loading,
    totals,
    logout,
    refresh: async () => {
      if (!walletUser) {
        return;
      }

      await refreshData(walletUser);
    },
    refreshBalances: async () => {
      if (!walletUser || !includeBalances) {
        return;
      }

      try {
        const result = await fetchWalletBalances(walletUser.address);
        setBalances(result.balances || {});
        setErrors((current) => ({ ...current, balances: "" }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          balances: error instanceof Error ? error.message : "Unable to load balances.",
        }));
      }
    },
    refreshTransactions: async () => {
      if (!walletUser || !includeTransactions) {
        return;
      }

      try {
        const result = await fetchWalletTransactions(walletUser.address);
        setTransactions(result.txs || []);
        setErrors((current) => ({ ...current, transactions: "" }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          transactions: error instanceof Error ? error.message : "Unable to load wallet activity.",
        }));
      }
    },
    refreshLinks: async () => {
      if (!walletUser || !includeLinks) {
        return;
      }

      try {
        const result = await listPaymentLinks(walletUser.email);
        setPaymentLinks(result);
        setErrors((current) => ({ ...current, links: "" }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          links: error instanceof Error ? error.message : "Unable to load payment links.",
        }));
      }
    },
    refreshPayments: async () => {
      if (!walletUser || !includePayments) {
        return;
      }

      try {
        const result = await listPayments(walletUser.email);
        setPayments(result);
        setErrors((current) => ({ ...current, payments: "" }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          payments: error instanceof Error ? error.message : "Unable to load payments.",
        }));
      }
    },
    sendFromWallet: async (payload: {
      to: string;
      amount: string;
      token: string;
    }) => {
      if (!walletUser) {
        throw new Error("Wallet not found.");
      }

      const result = await sendWalletTransaction({
        ...payload,
        email: walletUser.email,
        arcKeyId: walletUser.arcKeyId,
      });

      await refreshData(walletUser);
      return result;
    },
  };
}
