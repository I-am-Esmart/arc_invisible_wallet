"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, ExternalLink, ReceiptText } from "lucide-react";
import { BackendApiError } from "@/lib/api/backend";
import { startPaymentForLink } from "@/lib/api/payments";
import {
  approveSmartRequestToken,
  checkSmartRequestAllowance,
  checkSmartRequestBalance,
  executeSmartRequestBridge,
  paySmartRequest,
  quoteSmartRequestBridge,
  resumeSmartRequestBridge,
  resumeSmartRequestPayment,
  verifySmartRequestPayer,
  type SmartRequestCheckoutResponse,
  type SmartRequestTransaction,
} from "@/lib/api/smart-requests";
import { saveWalletUser } from "@/lib/session/wallet";
import type { PaymentLink } from "@/lib/types/payment-link";
import type { SmartRequest } from "@/lib/types/smart-request";
import { Button } from "@/components/ui/button";
import type { SmartRequestBridge } from "@/lib/types/smart-request";

type CheckoutPhase =
  | "idle"
  | "code_sent"
  | "verifying_payer"
  | "checking_balance"
  | "estimating_bridge"
  | "bridging_usdc"
  | "confirming_bridge"
  | "confirming_arc_balance"
  | "approving_token"
  | "submitting_payment"
  | "confirming_arc"
  | "verifying_onchain"
  | "completed"
  | "error";

type PersistedCheckoutState = {
  payerEmail: string;
  challengeId: string;
  approvalIdempotencyKey: string;
  paymentIdempotencyKey: string;
  approvalTransactionId?: string;
  paymentTransactionId?: string;
  bridgeRequested?: boolean;
  bridgeId?: string;
  phase: CheckoutPhase;
};

const PHASES: Array<{ id: CheckoutPhase; label: string }> = [
  { id: "verifying_payer", label: "verifying payer" },
  { id: "checking_balance", label: "checking balance" },
  { id: "estimating_bridge", label: "estimating bridge" },
  { id: "bridging_usdc", label: "bridging USDC" },
  { id: "confirming_bridge", label: "confirming bridge" },
  { id: "confirming_arc_balance", label: "confirming Arc balance" },
  { id: "approving_token", label: "approving token" },
  { id: "submitting_payment", label: "submitting payment" },
  { id: "confirming_arc", label: "confirming on Arc" },
  { id: "verifying_onchain", label: "verifying onchain request status" },
  { id: "completed", label: "completed" },
];
const SHOW_PRIMARY_BRIDGE_FLOW = false;

function storageKey(smartRequestId: string) {
  return `veloxpay_smart_request_checkout:${smartRequestId}`;
}

function createIdempotencyKey(prefix: string, smartRequestId: string) {
  return `${prefix}:${smartRequestId}:${crypto.randomUUID()}`;
}

function readPersistedState(smartRequestId: string): PersistedCheckoutState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey(smartRequestId)) || "null") as PersistedCheckoutState | null;
  } catch {
    return null;
  }
}

function writePersistedState(smartRequestId: string, state: PersistedCheckoutState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(smartRequestId), JSON.stringify(state));
}

function explorerFromHash(txHash: string) {
  return txHash ? `https://testnet.arcscan.app/tx/${txHash}` : "";
}

function txExplorerUrl(transaction?: SmartRequestTransaction | null) {
  if (!transaction) {
    return "";
  }

  return transaction.explorerUrl || explorerFromHash(transaction.txHash);
}

function hasConfirmedGasSponsorship(transaction?: SmartRequestTransaction | null) {
  return Boolean(transaction?.gasSponsorship?.confirmed);
}

function phaseIndex(phase: CheckoutPhase) {
  return PHASES.findIndex((entry) => entry.id === phase);
}

export function SmartRequestCheckout({
  paymentLink,
  smartRequest,
}: {
  paymentLink: PaymentLink;
  smartRequest: SmartRequest;
}) {
  const [payerEmail, setPayerEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [approval, setApproval] = useState<SmartRequestTransaction | null>(null);
  const [paymentTransaction, setPaymentTransaction] = useState<SmartRequestTransaction | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [balance, setBalance] = useState("");
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);
  const [payFromEthereumSepolia, setPayFromEthereumSepolia] = useState(false);
  const [bridge, setBridge] = useState<SmartRequestBridge | null>(smartRequest.bridge || null);
  const [persisted, setPersisted] = useState<PersistedCheckoutState>(() => ({
    payerEmail: "",
    challengeId: "",
    approvalIdempotencyKey: createIdempotencyKey("smart-request-approve", smartRequest.id),
    paymentIdempotencyKey: createIdempotencyKey("smart-request-pay", smartRequest.id),
    bridgeRequested: false,
    bridgeId: smartRequest.bridge?.id,
    phase: "idle",
  }));

  const completed = phase === "completed";
  const canVerify = Boolean(payerEmail && verificationCode && challengeId && !isBusy && !completed);
  const waitingForCode = Boolean(challengeId);

  const persistedPaymentState = useMemo(() => readPersistedState(smartRequest.id), [smartRequest.id]);

  useEffect(() => {
    if (!persistedPaymentState) {
      return;
    }

    setPersisted(persistedPaymentState);
    setPayerEmail(persistedPaymentState.payerEmail);
    setChallengeId(persistedPaymentState.challengeId);
    setPayFromEthereumSepolia(Boolean(persistedPaymentState.bridgeRequested));
    setPhase(persistedPaymentState.phase === "completed" ? "completed" : "idle");

    if (
      persistedPaymentState.payerEmail
      && persistedPaymentState.bridgeRequested
      && ["estimating_bridge", "bridging_usdc", "confirming_bridge", "confirming_arc_balance", "error"].includes(persistedPaymentState.phase)
      && persistedPaymentState.phase !== "completed"
    ) {
      void resumeBridgeThenContinue(persistedPaymentState);
    } else if (
      persistedPaymentState.payerEmail
      && (persistedPaymentState.paymentTransactionId || persistedPaymentState.approvalTransactionId)
      && persistedPaymentState.phase !== "completed"
    ) {
      void resumeCheckout(persistedPaymentState);
    }
    // Run once for persisted recovery state loaded from localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedPaymentState]);

  function persistPatch(patch: Partial<PersistedCheckoutState>) {
    setPersisted((current) => {
      const next = {
        ...current,
        payerEmail,
        challengeId,
        ...patch,
      };
      writePersistedState(smartRequest.id, next);
      return next;
    });
  }

  function setRecoverableError(nextError: unknown, fallback: string) {
    const nextMessage = nextError instanceof BackendApiError || nextError instanceof Error
      ? nextError.message
      : fallback;
    setError(nextMessage);
    setMessage("This payment state is saved. You can retry or refresh to resume.");
    setPhase("error");
    persistPatch({ phase: "error" });
  }

  async function handleSendCode() {
    if (!payerEmail || isBusy) {
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      const challenge = await startPaymentForLink(paymentLink.linkCode || paymentLink.id, {
        payerEmail,
        linkToken: paymentLink.linkToken,
        username: paymentLink.username,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
      });
      setChallengeId(challenge.challengeId);
      setPhase("code_sent");
      setMessage(challenge.message || "We sent a verification code to your email.");
      persistPatch({
        payerEmail,
        challengeId: challenge.challengeId,
        phase: "code_sent",
      });
    } catch (nextError) {
      setRecoverableError(nextError, "Unable to send verification code.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runCheckout() {
    if (!canVerify) {
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      setPhase("verifying_payer");
      persistPatch({ phase: "verifying_payer" });
      const verified = await verifySmartRequestPayer(smartRequest.id, {
        payerEmail,
        verificationCode,
        challengeId,
        linkId: paymentLink.linkCode || paymentLink.id,
        linkToken: paymentLink.linkToken,
      });
      if (verified.payer) {
        saveWalletUser(verified.payer);
      }

      setPhase("checking_balance");
      persistPatch({ phase: "checking_balance" });
      const checkedBalance = await checkSmartRequestBalance(smartRequest.id, payerEmail);
      setBalance(checkedBalance.balance?.balance || "");

      if (!checkedBalance.balance?.hasEnoughBalance) {
        throw new Error(`Insufficient ${smartRequest.currency} on Arc.`);
      }

      await runContractPayment();
    } catch (nextError) {
      if (shouldBridgeAfterBalanceError(nextError)) {
        try {
          await runBridgeThenContinue();
        } catch (bridgeError) {
          setRecoverableError(bridgeError, "Unable to complete Smart Request payment.");
        } finally {
          setIsBusy(false);
        }
        return;
      }

      setRecoverableError(nextError, "Unable to complete Smart Request payment.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runContractPayment() {
      const allowance = await checkSmartRequestAllowance(smartRequest.id, payerEmail);
      setApprovalRequired(Boolean(allowance.allowance?.approvalRequired));

      if (allowance.allowance?.approvalRequired) {
        setPhase("approving_token");
        persistPatch({ phase: "approving_token" });
        const approvalResponse = await approveSmartRequestToken(smartRequest.id, {
          payerEmail,
          idempotencyKey: persisted.approvalIdempotencyKey,
        });
        setApproval(approvalResponse.approval || null);
        persistPatch({
          approvalTransactionId: approvalResponse.approval?.id,
          phase: "approving_token",
        });
      }

      setPhase("submitting_payment");
      persistPatch({ phase: "submitting_payment" });
      const submitted = await paySmartRequest(smartRequest.id, {
        payerEmail,
        approvalIdempotencyKey: persisted.approvalIdempotencyKey,
        paymentIdempotencyKey: persisted.paymentIdempotencyKey,
      });

      setPaymentTransaction(submitted.transaction || null);
      persistPatch({
        paymentTransactionId: submitted.transaction?.id,
        phase: "confirming_arc",
      });
      setPhase("confirming_arc");

      setPhase("verifying_onchain");
      persistPatch({ phase: "verifying_onchain" });

      if (!isCompletedOnchain(submitted)) {
        throw new Error("Payment transaction completed, but the Smart Request status was not verified.");
      }

      setReceiptUrl(submitted.payment?.receiptUrl || "");
      setPhase("completed");
      setMessage("Smart Request payment verified on Arc.");
      persistPatch({ phase: "completed" });
  }

  function shouldBridgeAfterBalanceError(nextError: unknown) {
    return Boolean(
      payFromEthereumSepolia
      && smartRequest.currency === "USDC"
      && nextError instanceof BackendApiError
      && nextError.status === 402
    );
  }

  async function runBridgeThenContinue() {
    if (smartRequest.currency !== "USDC") {
      throw new Error("Cross-chain Smart Request payments support USDC only. EURC remains Arc-only.");
    }

    setPhase("estimating_bridge");
    persistPatch({ phase: "estimating_bridge", bridgeRequested: true });
    const quoted = await quoteSmartRequestBridge(smartRequest.id, { payerEmail });
    setBridge(quoted.bridge || null);

    setPhase("bridging_usdc");
    persistPatch({ phase: "bridging_usdc", bridgeRequested: true, bridgeId: quoted.bridge?.id });
    const bridged = await executeSmartRequestBridge(smartRequest.id, { payerEmail });
    setBridge(bridged.bridge || null);

    setPhase("confirming_bridge");
    persistPatch({ phase: "confirming_bridge", bridgeRequested: true, bridgeId: bridged.bridge?.id });

    setPhase("confirming_arc_balance");
    persistPatch({ phase: "confirming_arc_balance", bridgeRequested: true, bridgeId: bridged.bridge?.id });
    const checkedBalance = await checkSmartRequestBalance(smartRequest.id, payerEmail);
    setBalance(checkedBalance.balance?.balance || "");

    if (!checkedBalance.balance?.hasEnoughBalance) {
      throw new Error("Bridge completed or is pending, but the Arc USDC balance is not confirmed yet. Refresh or resume before paying.");
    }

    await runContractPayment();
  }

  async function resumeBridgeThenContinue(state = persisted) {
    if (!state.payerEmail || isBusy) {
      return;
    }

    setIsBusy(true);
    setError("");
    setPhase("confirming_arc_balance");

    try {
      const resumed = await resumeSmartRequestBridge(smartRequest.id, {
        payerEmail: state.payerEmail,
      });
      setBridge(resumed.bridge || null);
      setBalance(resumed.balance?.balance || "");

      if (!resumed.arcBalanceConfirmed) {
        setMessage("Recovered the saved bridge state. Arc balance is still pending.");
        setPhase("idle");
        persistPatch({ phase: "idle", bridgeRequested: true, bridgeId: resumed.bridge?.id });
        return;
      }

      await runContractPayment();
    } catch (nextError) {
      setRecoverableError(nextError, "Unable to resume bridged Smart Request payment.");
    } finally {
      setIsBusy(false);
    }
  }

  async function resumeCheckout(state = persisted) {
    if (!state.payerEmail || isBusy) {
      return;
    }

    setIsBusy(true);
    setError("");
    setPhase("confirming_arc");

    try {
      const resumed = await resumeSmartRequestPayment(smartRequest.id, {
        payerEmail: state.payerEmail,
        approvalTransactionId: state.approvalTransactionId,
        paymentTransactionId: state.paymentTransactionId,
      });
      setApproval(resumed.approval || approval);
      setPaymentTransaction(resumed.transaction || paymentTransaction);
      setPhase("verifying_onchain");

      if (resumed.completed || isCompletedOnchain(resumed)) {
        setPhase("completed");
        setMessage("Smart Request payment verified on Arc.");
        persistPatch({ phase: "completed" });
        return;
      }

      setMessage("Recovered the saved transaction state. Continue checkout when ready.");
      setPhase("idle");
    } catch (nextError) {
      setRecoverableError(nextError, "Unable to resume Smart Request payment.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-brand-50/20 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <div className="text-sm font-semibold text-slate-900">Smart Request checkout</div>
        <div className="mt-3 grid gap-2">
          {PHASES.map((entry) => {
            const currentIndex = phaseIndex(phase);
            const entryIndex = phaseIndex(entry.id);
            const isDone = completed || (currentIndex > entryIndex && currentIndex >= 0);
            const isCurrent = phase === entry.id;
            return (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <span className="capitalize text-slate-700">{entry.label}</span>
                <span className={isDone ? "text-emerald-700" : isCurrent ? "text-brand-700" : "text-slate-400"}>
                  {isDone ? "done" : isCurrent ? "in progress" : "waiting"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Your email</span>
        <input
          type="email"
          value={payerEmail}
          onChange={(event) => {
            setPayerEmail(event.target.value);
            setError("");
          }}
          placeholder="you@example.com"
          disabled={isBusy || completed}
          className="vp-control"
        />
      </label>

      {waitingForCode ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="123456"
            disabled={isBusy || completed}
            className="vp-control"
          />
        </label>
      ) : (
        <p className="text-sm leading-6 text-slate-500">
          We will verify your email first, then load your Circle wallet for the Smart Request payment.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {waitingForCode ? (
          <>
            <Button type="button" className="w-full py-3 text-base" disabled={!canVerify} onClick={runCheckout}>
              {isBusy ? "Working..." : "Verify and pay"}
            </Button>
            <Button type="button" variant="secondary" className="w-full py-3 text-base" disabled={isBusy || completed} onClick={handleSendCode}>
              Send a new code
            </Button>
          </>
        ) : (
          <Button type="button" className="w-full py-3 text-base" disabled={!payerEmail || isBusy || completed} onClick={handleSendCode}>
            {isBusy ? "Sending code..." : "Verify before paying"}
          </Button>
        )}
      </div>

      {SHOW_PRIMARY_BRIDGE_FLOW && smartRequest.currency === "USDC" && !completed ? (
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={payFromEthereumSepolia}
            onChange={(event) => {
              setPayFromEthereumSepolia(event.target.checked);
              persistPatch({ bridgeRequested: event.target.checked });
            }}
            disabled={isBusy}
            className="mt-1"
          />
          <span>
            <span className="block font-semibold text-slate-900">Pay USDC from Ethereum Sepolia first</span>
            <span className="block leading-6">
              VeloxPay will bridge USDC to Arc Testnet, confirm your Arc balance, then continue with token approval and contract payment.
            </span>
          </span>
        </label>
      ) : null}

      {smartRequest.currency === "EURC" ? (
        <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          EURC payments stay on Arc Testnet for now.
        </div>
      ) : null}

      {persisted.paymentTransactionId || persisted.approvalTransactionId ? (
        <Button type="button" variant="secondary" disabled={isBusy || completed} onClick={() => resumeCheckout()}>
          Resume saved payment
        </Button>
      ) : null}

      {balance ? (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          Balance checked: {balance} {smartRequest.currency}
        </div>
      ) : null}

      {approvalRequired !== null ? (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          Token approval {approvalRequired ? "is required before payment." : "is already sufficient."}
        </div>
      ) : null}

      {bridge ? <BridgeSummary bridge={bridge} /> : null}

      {message ? <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

      {(approval || paymentTransaction || receiptUrl) ? (
        <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white text-sm shadow-card">
          {completed ? (
            <div className="flex items-start gap-3 border-b border-line bg-gradient-to-br from-white via-white to-brand-50/40 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="text-lg font-semibold text-ink-heading">Payment completed</div>
                <p className="mt-1 text-sm leading-6 text-ink-body">
                  The contract state was verified and the receipt is ready.
                </p>
              </div>
            </div>
          ) : null}
          <div className="space-y-4 p-5">
            {approval ? (
              <TransactionLink label="Approval transaction" transaction={approval} />
            ) : null}
            {paymentTransaction ? (
              <TransactionLink label="Payment transaction" transaction={paymentTransaction} />
            ) : null}
            {receiptUrl ? (
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-button transition hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                View receipt
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isCompletedOnchain(response: SmartRequestCheckoutResponse) {
  const status = response.onchainRequest?.status || response.smartRequest.onchainStatus;
  return status === "settled" || status === "funded";
}

function TransactionLink({
  label,
  transaction,
}: {
  label: string;
  transaction: SmartRequestTransaction;
}) {
  const href = txExplorerUrl(transaction);

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className="mt-2 break-all font-mono text-xs text-ink-heading">{transaction.txHash || transaction.id}</div>
      {hasConfirmedGasSponsorship(transaction) ? (
        <div className="mt-2 font-medium text-emerald-700">Network fee sponsored by VeloxPay</div>
      ) : null}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-brand-700 transition hover:text-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
          View on Arc Explorer
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function BridgeSummary({ bridge }: { bridge: SmartRequestBridge }) {
  const quote = bridge.quote;
  const fees = quote?.fees || [];
  const gasFees = quote?.gasFees || [];
  const visibleSteps = bridge.steps.length ? bridge.steps : bridge.events.map((event) => ({
    name: event.method,
    status: event.status,
    chain: event.chain,
    txHash: event.txHash,
    explorerUrl: event.explorerUrl,
  }));

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">Bridge stage</div>
          <div className="text-slate-500">{bridge.sourceNetwork} to {bridge.destinationNetwork}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
          {bridge.status.replace("_", " ")}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <BridgeMetric label="Source network" value={bridge.sourceNetwork} />
        <BridgeMetric label="Destination network" value={bridge.destinationNetwork} />
        <BridgeMetric label="Source amount" value={`${bridge.sourceAmount} ${bridge.token}`} />
        <BridgeMetric label="Expected received" value={`${bridge.expectedReceivedAmount || bridge.sourceAmount} ${bridge.token}`} />
      </div>

      {fees.length || gasFees.length ? (
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="font-medium text-slate-800">Estimated fees</div>
          <div className="mt-2 space-y-1 text-slate-600">
            {fees.map((fee, index) => (
              <div key={`${fee.type}-${index}`} className="flex justify-between gap-3">
                <span className="capitalize">{fee.type || "bridge"} fee</span>
                <span>{fee.amount || "0"} {fee.token || "USDC"}</span>
              </div>
            ))}
            {gasFees.map((fee, index) => (
              <div key={`${fee.name}-${index}`} className="flex justify-between gap-3">
                <span>{fee.name || fee.blockchain || "Network fee"}</span>
                <span>{fee.fee || "Estimated"} {fee.token}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {visibleSteps.length ? (
        <div className="space-y-2">
          {visibleSteps.map((step, index) => (
            <div key={`${step.name}-${index}`} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800">{step.name || "Bridge step"}</span>
                <span className="text-xs font-semibold uppercase text-slate-500">{step.status}</span>
              </div>
              {step.txHash ? (
                <a href={step.explorerUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-brand-700 hover:underline">
                  {step.txHash}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {bridge.error?.message ? (
        <div className="rounded-xl bg-rose-50 p-3 text-rose-700">{bridge.error.message}</div>
      ) : null}
    </div>
  );
}

function BridgeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}
