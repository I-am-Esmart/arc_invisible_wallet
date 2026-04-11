"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { clearWalletUser, getStoredWalletUser } from "@/lib/session/wallet";
import type { WalletUser } from "@/lib/types/wallet";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [walletUser, setWalletUser] = useState<WalletUser | null>(null);

  useEffect(() => {
    setWalletUser(getStoredWalletUser());
  }, [pathname]);

  function handleLogout() {
    clearWalletUser();
    setWalletUser(null);
    router.push("/");
    router.refresh();
  }

  const navItems = walletUser
    ? [
        { href: "/dashboard", label: "Overview" },
        { href: "/wallet", label: "Wallet" },
        { href: "/links", label: "Links" },
        { href: "/payments", label: "Payments" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/login", label: "Create wallet" },
      ];

  return (
    <header className="mb-8 flex flex-col gap-4 rounded-[2rem] bg-white/85 px-5 py-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          VeloxPay
        </Link>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:bg-slate-800 dark:text-brand-300">
          Arc wallet + payments
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Button key={item.href} asChild variant={isActive ? "secondary" : "ghost"}>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          );
        })}
        {!walletUser ? (
          <Button asChild>
            <Link href="/login">Create wallet</Link>
          </Button>
        ) : (
          <>
            <div className="hidden rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200 sm:block">
              {walletUser.displayName || walletUser.email}
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Log out
            </Button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
