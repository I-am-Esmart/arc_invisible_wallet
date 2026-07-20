"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentTimeline } from "@/components/shared/payment-timeline";
import type { Payment } from "@/lib/types/payment";
import { formatDate, formatMoney } from "@/lib/utils/format";

function buildReceiptHref(payment: Payment) {
  if (!payment.receiptUrl) {
    return "";
  }

  if (!payment.ownerEmail) {
    return payment.receiptUrl;
  }

  try {
    const url = new URL(payment.receiptUrl, window.location.origin);
    url.searchParams.set("ownerEmail", payment.ownerEmail);
    return `${url.pathname}${url.search}`;
  } catch {
    return payment.receiptUrl;
  }
}

export function PaymentsTable({
  payments,
  title = "Payments",
  description = "Recent payments collected through payment requests.",
  emptyMessage = "No payments yet.",
}: {
  payments: Payment[];
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  const [expandedId, setExpandedId] = useState("");

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {description}
      </p>

      {payments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {payments.map((payment) => {
            const expanded = expandedId === payment.id;

            return (
              <div key={payment.id} className="rounded-3xl border border-slate-200 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          payment.status === "completed"
                            ? "success"
                            : payment.status === "failed"
                              ? "error"
                              : "warning"
                        }
                      >
                        {payment.status}
                      </Badge>
                      {payment.direction ? (
                        <Badge variant="neutral">{payment.direction === "outgoing" ? "paid" : "received"}</Badge>
                      ) : null}
                      {payment.customerName ? <Badge variant="neutral">{payment.customerName}</Badge> : null}
                    </div>
                    <div className="mt-3 text-base font-semibold text-slate-900">
                      {payment.linkLabel || payment.linkId}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                      <span>{formatMoney(payment.amount, payment.currency)}</span>
                      <span>
                        {payment.direction === "outgoing"
                          ? payment.ownerEmail || "Receiver unavailable"
                          : payment.payerEmail || "Payer email unavailable"}
                      </span>
                      <span>{formatDate(payment.paidAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {payment.receiptUrl ? (
                      <a
                        href={buildReceiptHref(payment)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                      >
                        Receipt
                      </a>
                    ) : null}
                    {payment.explorerUrl ? (
                      <a
                        href={payment.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                      >
                        Explorer
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? "" : payment.id)}
                      className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      {expanded ? "Hide timeline" : "View timeline"}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Payment timeline</h3>
                    <div className="mt-4">
                      <PaymentTimeline timeline={payment.timeline} />
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
