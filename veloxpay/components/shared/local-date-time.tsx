"use client";

// Formats a date in the viewer's own local timezone. Used on pages (like the receipt) that are
// rendered on the server, where `toLocaleString()` would otherwise use the server's timezone
// (UTC on Vercel) instead of whoever is actually looking at the page. suppressHydrationWarning
// is safe here: React patches mismatched text content on hydration, so the UTC server render is
// swapped for the correct local time as soon as the page hydrates, with no visible flash.
export function LocalDateTime({ value }: { value?: string }) {
  if (!value) {
    return <>-</>;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return <>{value}</>;
  }

  return <span suppressHydrationWarning>{parsed.toLocaleString()}</span>;
}
