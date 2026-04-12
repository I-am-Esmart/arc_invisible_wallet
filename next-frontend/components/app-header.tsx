"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setWalletUser(getStoredWalletUser());
  }, [pathname]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearWalletUser();
    setWalletUser(null);
    setIsMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  const navItems = useMemo(
    () =>
      walletUser
        ? [
            { href: "/dashboard", label: "Overview" },
            { href: "/wallet", label: "Wallet" },
            { href: "/links", label: "Links" },
            { href: "/payments", label: "Payments" },
          ]
        : [
            { href: "/", label: "Home" },
            { href: "/login", label: "Create wallet" },
          ],
    [walletUser],
  );

  return (
    <>
      <header className="mb-8 rounded-[2rem] bg-white/85 px-5 py-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/80 dark:ring-slate-700">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                VeloxPay
              </Link>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-brand-700 dark:bg-slate-800 dark:text-brand-300">
                Arc wallet + payments
              </span>
            </div>
            {walletUser ? (
              <p className="mt-2 truncate text-sm text-slate-500 dark:text-slate-300 md:hidden">
                Signed in as {walletUser.displayName || walletUser.email}
              </p>
            ) : null}
          </div>

          <div className="hidden items-center gap-2 md:flex">
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
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {walletUser.displayName || walletUser.email}
                </div>
                <Button variant="secondary" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            )}
            <ThemeToggle />
          </div>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <span className="relative h-4 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                  isMobileMenuOpen ? "top-[7px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                  isMobileMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${
                  isMobileMenuOpen ? "top-[7px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 transition duration-300 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(84vw,360px)] flex-col border-l border-slate-200 bg-white px-5 py-5 shadow-2xl transition-transform duration-300 dark:border-slate-700 dark:bg-slate-950 md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Navigation</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Move through VeloxPay without squeezing through tiny tabs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {walletUser ? (
          <div className="mt-6 rounded-3xl bg-slate-50 px-4 py-4 dark:bg-slate-900/80">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Signed in
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
              {walletUser.displayName || "VeloxPay user"}
            </p>
            <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-300">
              {walletUser.email}
            </p>
          </div>
        ) : null}

        <nav className="mt-6 flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 space-y-3">
          {!walletUser ? (
            <Button asChild className="w-full justify-center">
              <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                Create wallet
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" className="w-full justify-center" onClick={handleLogout}>
              Log out
            </Button>
          )}
          <div className="flex justify-start">
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
