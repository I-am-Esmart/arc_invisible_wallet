import type { WalletUser } from "@/lib/types/wallet";

const WALLET_USER_KEY = "veloxpay_wallet_user";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function writeCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 365) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function getStoredWalletUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(WALLET_USER_KEY) || "null") as WalletUser | null;
  } catch {
    return null;
  }
}

export function saveWalletUser(user: WalletUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WALLET_USER_KEY, JSON.stringify(user));
  if (user.displayName) {
    window.localStorage.setItem("walletDisplayName", user.displayName);
  }

  writeCookie("veloxpay_wallet_email", user.email);
  writeCookie("veloxpay_wallet_address", user.address);
  writeCookie("veloxpay_wallet_name", user.displayName || "");
  writeCookie("veloxpay_owner_email", user.email);
  writeCookie("veloxpay_owner_name", user.displayName || "");
}

export function clearWalletUser() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(WALLET_USER_KEY);
  }

  clearCookie("veloxpay_wallet_email");
  clearCookie("veloxpay_wallet_address");
  clearCookie("veloxpay_wallet_name");
  clearCookie("veloxpay_owner_email");
  clearCookie("veloxpay_owner_name");
}

export function getSavedWalletDisplayName() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("walletDisplayName") || "";
}

export function getCookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return entry ? safeDecode(entry.split("=").slice(1).join("=")) : "";
}
