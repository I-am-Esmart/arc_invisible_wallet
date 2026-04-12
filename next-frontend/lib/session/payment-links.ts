import type { PaymentLink } from "@/lib/types/payment-link";

function getStorageKey(ownerEmail: string) {
  return `veloxpay_payment_links:${String(ownerEmail || "").trim().toLowerCase()}`;
}

function mergePaymentLinks(primary: PaymentLink[], secondary: PaymentLink[]) {
  const seen = new Set<string>();
  const merged: PaymentLink[] = [];

  for (const link of [...primary, ...secondary]) {
    if (!link) {
      continue;
    }

    const key = link.id || link.url || `${link.username}-${link.amount}-${link.createdAt || ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(link);
  }

  return merged.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
}

export function readStoredPaymentLinks(ownerEmail: string) {
  if (typeof window === "undefined" || !ownerEmail) {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(getStorageKey(ownerEmail)) || "[]") as PaymentLink[];
  } catch {
    return [];
  }
}

export function writeStoredPaymentLinks(ownerEmail: string, paymentLinks: PaymentLink[]) {
  if (typeof window === "undefined" || !ownerEmail) {
    return;
  }

  window.localStorage.setItem(getStorageKey(ownerEmail), JSON.stringify(paymentLinks));
}

export function mergeAndStorePaymentLinks(ownerEmail: string, paymentLinks: PaymentLink[]) {
  const existing = readStoredPaymentLinks(ownerEmail);
  const merged = mergePaymentLinks(paymentLinks, existing);
  writeStoredPaymentLinks(ownerEmail, merged);
  return merged;
}

export function upsertStoredPaymentLink(ownerEmail: string, paymentLink: PaymentLink) {
  return mergeAndStorePaymentLinks(ownerEmail, [paymentLink]);
}
