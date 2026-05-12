"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentLinkQr } from "./payment-link-qr";
import { PaymentTimeline } from "@/components/shared/payment-timeline";
import type { PaymentLink } from "@/lib/types/payment-link";
import { formatDate, formatMoney } from "@/lib/utils/format";

function getLinkPath(link: PaymentLink) {
  if (link.url) {
    try {
      return new URL(link.url).pathname;
    } catch {
      return link.url;
    }
  }

  if (link.linkCode) {
    return `/${link.username}/${link.amount}/${link.linkCode}`;
  }

  return `/${link.username}/${link.amount}`;
}

export function PaymentLinksTable({
  paymentLinks,
}: {
  paymentLinks: PaymentLink[];
}) {
  const [expandedId, setExpandedId] = useState("");
  const [copiedId, setCopiedId] = useState("");

  async function handleCopy(link: PaymentLink) {
    if (!link.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(""), 2000);
    } catch {
      setCopiedId("");
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payment requests</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every request you can share, scan, and track from one place.
          </p>
        </div>
      </div>

      {paymentLinks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
          No payment requests yet. Create one to send a simple pay-me link.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {paymentLinks.map((link) => {
            const path = getLinkPath(link);
            const expanded = expandedId === link.id;

            return (
              <div key={link.id} className="rounded-3xl border border-slate-200 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={link.status === "active" ? "success" : "warning"}>
                        {link.status}
                      </Badge>
                      {link.recurrence?.interval && link.recurrence.interval !== "one-time" ? (
                        <Badge variant="neutral">{link.recurrence.label || link.recurrence.interval}</Badge>
                      ) : null}
                      {link.customerName || link.customerEmail ? (
                        <Badge variant="neutral">
                          {link.customerName || link.customerEmail}
                        </Badge>
                      ) : null}
                    </div>

                    <Link href={path} className="mt-3 block break-all text-base font-semibold text-slate-900 hover:text-brand-600">
                      {path}
                    </Link>

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                      <span>{formatMoney(link.amount, link.currency)}</span>
                      <span>{link.description || "No description yet"}</span>
                      <span>Created {formatDate(link.createdAt)}</span>
                      <span>{link.openedCount || 0} open{Number(link.openedCount || 0) === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={path}
                      className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleCopy(link)}
                      className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      {copiedId === link.id ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? "" : link.id)}
                      className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      {expanded ? "Hide details" : "View details"}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <PaymentLinkQr url={link.url || path} />
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-900">Request details</h3>
                        <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Cadence</div>
                            <div className="mt-1 text-slate-900">{link.recurrence?.label || "One-time request"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Next due</div>
                            <div className="mt-1 text-slate-900">{formatDate(link.recurrence?.nextDueAt)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Customer</div>
                            <div className="mt-1 text-slate-900">{link.customerName || link.customerEmail || "-"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Last paid</div>
                            <div className="mt-1 text-slate-900">{formatDate(link.lastPaidAt)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-900">Status timeline</h3>
                        <div className="mt-4">
                          <PaymentTimeline timeline={link.timeline} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
