"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { VeloxPayLogo } from "@/components/brand/veloxpay-logo";
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
            { href: "/links", label: "Get paid" },
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
      <header className="mb-8 rounded-2xl border border-line bg-white/90 px-4 py-3 shadow-card backdrop-blur sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="inline-flex items-center gap-3">
                <VeloxPayLogo className="h-10 w-10" showWordmark />
              </Link>
              <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 sm:inline-flex">
                Arc payments
              </span>
            </div>
            {walletUser ? (
              <p className="mt-2 truncate text-sm text-ink-muted md:hidden">
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
                <div className="rounded-xl border border-line bg-slate-50 px-3 py-2 text-sm text-ink-body">
                  {walletUser.displayName || walletUser.email}
                </div>
                <Button variant="secondary" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink-body shadow-sm transition hover:bg-slate-50 md:hidden"
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
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(84vw,360px)] flex-col border-l border-line bg-white px-5 py-5 shadow-2xl transition-transform duration-300 md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-ink-heading">Navigation</p>
            <p className="mt-1 text-sm text-ink-muted">Wallets, requests, payments, and receipts.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink-body transition hover:bg-slate-50"
          >
            <span aria-hidden="true">x</span>
          </button>
        </div>

        {walletUser ? (
          <div className="mt-6 rounded-2xl border border-line bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Signed in</p>
            <p className="mt-2 text-base font-semibold text-ink-heading">
              {walletUser.displayName || "VeloxPay user"}
            </p>
            <p className="mt-1 break-all text-sm text-ink-muted">{walletUser.email}</p>
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
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "bg-slate-50 text-ink-body hover:bg-brand-50 hover:text-brand-700"
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
        </div>
      </aside>
    </>
  );
}
