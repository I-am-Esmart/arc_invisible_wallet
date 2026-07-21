"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaymentTimeline } from "@/components/shared/payment-timeline";
import {
  approveProtectedRelease,
  claimExpiredProtectedRefund,
  listProtectedSmartRequests,
  submitProtectedDeliverable,
  type SmartRequestTransaction,
} from "@/lib/api/smart-requests";
import type { ManagedProtectedSmartRequest } from "@/lib/types/smart-request";
import type { WalletUser } from "@/lib/types/wallet";
import { formatDate, formatMoney } from "@/lib/utils/format";

type Role = "payee" | "payer";

function createIdempotencyKey(action: string, requestId: string) {
  return `${action}:${requestId}:${crypto.randomUUID()}`;
}

function transactionExplorerUrl(transaction?: SmartRequestTransaction | null) {
  if (!transaction) {
    return "";
  }

  return transaction.explorerUrl || (transaction.txHash ? `https://testnet.arcscan.app/tx/${transaction.txHash}` : "");
}

export function ProtectedRequestsPanel({
  walletUser,
}: {
  walletUser: WalletUser;
}) {
  const [role, setRole] = useState<Role>("payee");
  const [requests, setRequests] = useState<ManagedProtectedSmartRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh(nextRole = role) {
    setLoading(true);
    setError("");

    try {
      const result = await listProtectedSmartRequests(nextRole, walletUser.email);
      setRequests(result.smartRequests);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load protected requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(role);
    // Refresh when switching between preserved payer/payee views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, walletUser.email]);

  function updateRequest(updated: ManagedProtectedSmartRequest) {
    setRequests((current) => current.map((request) => (request.id === updated.id ? updated : request)));
  }

  const copy = useMemo(() => (
    role === "payee"
      ? {
          title: "Funded protected requests",
          description: "Submit delivery proof for protected payments that are funded and waiting on your deliverable.",
          empty: "No funded protected requests for you yet.",
        }
      : {
          title: "Protected requests awaiting your approval",
          description: "Review submitted deliverables, compare hashes, release funds, or claim an expired refund if the contract permits it.",
          empty: "No funded or submitted protected requests to review.",
        }
  ), [role]);

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Protected payment management</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {copy.description}
          </p>
        </div>
        <div className="inline-flex rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRole("payee")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              role === "payee" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Payee
          </button>
          <button
            type="button"
            onClick={() => setRole("payer")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              role === "payer" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Payer
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-700">{copy.title}</div>
        <Button type="button" variant="secondary" disabled={loading} onClick={() => refresh()}>
          {loading ? "Refreshing..." : "Refresh protected requests"}
        </Button>
      </div>

      {message ? <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

      {requests.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
          {copy.empty}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((request) => (
            <ProtectedRequestCard
              key={request.id}
              request={request}
              role={role}
              actorEmail={walletUser.email}
              onUpdated={(updated, nextMessage) => {
                updateRequest(updated);
                setMessage(nextMessage);
                setError("");
              }}
              onError={(nextError) => {
                setError(nextError);
                setMessage("");
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProtectedRequestCard({
  request,
  role,
  actorEmail,
  onUpdated,
  onError,
}: {
  request: ManagedProtectedSmartRequest;
  role: Role;
  actorEmail: string;
  onUpdated: (request: ManagedProtectedSmartRequest, message: string) => void;
  onError: (message: string) => void;
}) {
  const [deliverableUrl, setDeliverableUrl] = useState(request.deliverableUrl || "");
  const [note, setNote] = useState(request.deliverableNote || "");
  const [busyAction, setBusyAction] = useState("");
  const [transaction, setTransaction] = useState<SmartRequestTransaction | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function runAction(action: "submit" | "release" | "refund") {
    setBusyAction(action);
    onError("");

    try {
      if (action === "submit") {
        const result = await submitProtectedDeliverable(request.id, {
          actorEmail,
          deliverableUrl,
          note,
          idempotencyKey: createIdempotencyKey("smart-request-deliverable", request.id),
        });
        setTransaction(result.transaction);
        onUpdated(result.smartRequest, "Deliverable hash submitted and verified on Arc.");
      }

      if (action === "release") {
        const result = await approveProtectedRelease(request.id, {
          actorEmail,
          idempotencyKey: createIdempotencyKey("smart-request-release", request.id),
        });
        setTransaction(result.transaction);
        onUpdated(result.smartRequest, "Protected payment released and verified on Arc.");
      }

      if (action === "refund") {
        const result = await claimExpiredProtectedRefund(request.id, {
          actorEmail,
          idempotencyKey: createIdempotencyKey("smart-request-refund", request.id),
        });
        setTransaction(result.transaction);
        onUpdated(result.smartRequest, "Expired protected payment refunded and verified on Arc.");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to complete protected payment action.");
    } finally {
      setBusyAction("");
    }
  }

  const actionDisabled = Boolean(busyAction);
  const submitDisabled = actionDisabled || !request.permissions.canSubmitDeliverable || !deliverableUrl;
  const releaseDisabled = actionDisabled || !request.permissions.canApproveRelease || !request.hashMatchesOnchain;
  const refundDisabled = actionDisabled || !request.permissions.canClaimExpiredRefund;
  const visibleTransaction = transaction || null;
  const visibleTransactionHref = transactionExplorerUrl(visibleTransaction);

  return (
    <div className="rounded-3xl border border-slate-200 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Protected</Badge>
            <Badge variant={request.onchainStatus === "submitted" ? "warning" : request.onchainStatus === "funded" ? "success" : "neutral"}>
              Contract: {request.onchainStatus}
            </Badge>
            <Badge variant="neutral">{role}</Badge>
          </div>
          <div className="mt-3 text-base font-semibold text-slate-900">
            {request.description || request.paymentLinkId || request.id}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <span>{formatMoney(request.amount, request.currency)}</span>
            <span>Due {formatDate(request.dueDate)}</span>
            <span>{request.offchainStatus}</span>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Hide timeline" : "View timeline"}
        </Button>
      </div>

      {role === "payee" ? (
        <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Deliverable URL</span>
            <input
              type="url"
              value={deliverableUrl}
              onChange={(event) => setDeliverableUrl(event.target.value)}
              placeholder="https://example.com/delivery"
              disabled={!request.permissions.canSubmitDeliverable || actionDisabled}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Optional note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              disabled={!request.permissions.canSubmitDeliverable || actionDisabled}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <Button type="button" disabled={submitDisabled} onClick={() => runAction("submit")}>
            {busyAction === "submit" ? "Submitting..." : "Submit deliverable hash"}
          </Button>
          {!request.permissions.canSubmitDeliverable ? (
            <p className="text-sm text-slate-500">Deliverable submission is only available while the protected request is funded.</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4">
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>Deliverable submitted: {formatDate(request.deliverableSubmittedAt)}</div>
            <div>Hash match: {request.hashMatchesOnchain ? "yes" : "not yet"}</div>
          </div>
          {request.deliverableUrl ? (
            <a href={request.deliverableUrl} target="_blank" rel="noreferrer" className="inline-flex font-semibold text-brand-700 hover:underline">
              View deliverable
            </a>
          ) : (
            <p className="text-sm text-slate-500">No deliverable has been submitted yet.</p>
          )}
          <div className="space-y-2 break-all rounded-2xl bg-white p-3 text-xs text-slate-600">
            <div>Local hash: {request.localDeliverableHash || "-"}</div>
            <div>Onchain hash: {request.deliverableHash || "-"}</div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" disabled={releaseDisabled} onClick={() => runAction("release")}>
              {busyAction === "release" ? "Releasing..." : "Approve and release"}
            </Button>
            <Button type="button" variant="secondary" disabled={refundDisabled} onClick={() => runAction("refund")}>
              {busyAction === "refund" ? "Refunding..." : "Claim expired refund"}
            </Button>
          </div>
        </div>
      )}

      {visibleTransaction ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="font-medium text-slate-900">Submission transaction status: {visibleTransaction.state}</div>
          <div className="mt-1 break-all font-mono text-xs text-slate-500">{visibleTransaction.txHash || visibleTransaction.id}</div>
          {visibleTransactionHref ? (
            <a href={visibleTransactionHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-semibold text-brand-700 hover:underline">
              View on Arc Explorer
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {request.explorerUrls.funding ? <ExplorerLink href={request.explorerUrls.funding}>Funding transaction</ExplorerLink> : null}
        {request.explorerUrls.deliverable ? <ExplorerLink href={request.explorerUrls.deliverable}>Deliverable transaction</ExplorerLink> : null}
        {request.explorerUrls.release ? <ExplorerLink href={request.explorerUrls.release}>Release transaction</ExplorerLink> : null}
        {request.explorerUrls.refund ? <ExplorerLink href={request.explorerUrls.refund}>Refund transaction</ExplorerLink> : null}
      </div>

      {expanded ? (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Payment timeline</h3>
          <div className="mt-4">
            <PaymentTimeline timeline={request.timeline} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
      {children}
    </a>
  );
}
