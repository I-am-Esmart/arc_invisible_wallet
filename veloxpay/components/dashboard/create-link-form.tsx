"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchFeatureCapabilities } from "@/lib/api/features";
import { createPaymentLink } from "@/lib/api/payment-links";
import { createSmartRequest } from "@/lib/api/smart-requests";
import {
  SMART_REQUEST_MAX_RECIPIENTS,
  calculateSmartRequestRecipients,
  validateSmartRequestDraft,
  type SmartRequestMode,
  type SmartRequestRecipientDraft,
} from "@/lib/smart-requests/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { upsertStoredPaymentLink } from "@/lib/session/payment-links";
import type { SavedCustomer } from "@/lib/types/customer";
import type { PaymentCurrency, PaymentLink } from "@/lib/types/payment-link";
import type { SmartRequestResponse } from "@/lib/types/smart-request";
import type { WalletUser } from "@/lib/types/wallet";

type CreateState = {
  status: "idle" | "success" | "error";
  message?: string;
  url?: string;
  paymentLink?: PaymentLink;
  smartRequest?: SmartRequestResponse["smartRequest"];
};

const OWNER_EMAIL_KEY = "veloxpay_owner_email";
const OWNER_NAME_KEY = "veloxpay_owner_name";
const DEFAULT_RECIPIENT_ID = "recipient-1";

function createRecipient(overrides: Partial<SmartRequestRecipientDraft> = {}): SmartRequestRecipientDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    role: "",
    email: "",
    walletAddress: "",
    percentage: "100",
    ...overrides,
  };
}

function contractBehaviourForMode(mode: SmartRequestMode) {
  if (mode === "protected") {
    return "Funds are held by the Arc smart contract until the payer approves release after delivery, or until an eligible refund path is used.";
  }

  if (mode === "split") {
    return "Funds are distributed by the Arc smart contract to each recipient according to the allocation percentages.";
  }

  return "Funds settle as a normal VeloxPay payment request to one recipient.";
}

export function CreateLinkForm({
  compact = false,
  walletUser,
  customers = [],
  onCreated,
}: {
  compact?: boolean;
  walletUser?: WalletUser | null;
  customers?: SavedCustomer[];
  onCreated?: (paymentLink?: PaymentLink) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<CreateState>({ status: "idle" });
  const [isPending, setIsPending] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<PaymentCurrency>("USDC");
  const [description, setDescription] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [recurrence, setRecurrence] = useState("one-time");
  const [paymentMode, setPaymentMode] = useState<SmartRequestMode>("standard");
  const [smartRequestsAvailable, setSmartRequestsAvailable] = useState(false);
  const [smartRequestsMessage, setSmartRequestsMessage] = useState("");
  const [deliverableDescription, setDeliverableDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [refundEligibilityDate, setRefundEligibilityDate] = useState("");
  const [recipients, setRecipients] = useState<SmartRequestRecipientDraft[]>([
    createRecipient({ id: DEFAULT_RECIPIENT_ID }),
  ]);
  const [copied, setCopied] = useState(false);

  function syncOwnerCookies(email: string, name: string) {
    if (!email) {
      return;
    }

    document.cookie = `veloxpay_owner_email=${encodeURIComponent(email)}; path=/; max-age=31536000; samesite=lax`;
    document.cookie = `veloxpay_owner_name=${encodeURIComponent(name || "")}; path=/; max-age=31536000; samesite=lax`;
  }

  useEffect(() => {
    if (walletUser?.email) {
      const nextName = walletUser.displayName || "";
      setOwnerEmail(walletUser.email);
      setOwnerName(nextName);
      setRecipients((current) => [
        {
          ...current[0],
          name: nextName || walletUser.email,
          role: "Creator",
          email: walletUser.email,
          walletAddress: walletUser.address || current[0]?.walletAddress || "",
          percentage: current[0]?.percentage || "100",
        },
        ...current.slice(1),
      ]);
      localStorage.setItem(OWNER_EMAIL_KEY, walletUser.email);
      localStorage.setItem(OWNER_NAME_KEY, nextName);
      syncOwnerCookies(walletUser.email, nextName);
      if (compact) {
        router.refresh();
      }
      return;
    }

    const savedEmail = localStorage.getItem(OWNER_EMAIL_KEY) || "";
    const savedName = localStorage.getItem(OWNER_NAME_KEY) || "";
    setOwnerEmail(savedEmail);
    setOwnerName(savedName);

    if (savedEmail) {
      syncOwnerCookies(savedEmail, savedName);
      if (compact) {
        router.refresh();
      }
    }
  }, [compact, router, walletUser]);

  useEffect(() => {
    let cancelled = false;

    fetchFeatureCapabilities()
      .then((features) => {
        if (cancelled) {
          return;
        }

        setSmartRequestsAvailable(Boolean(features.payments.smartRequests));
        setSmartRequestsMessage(features.payments.smartRequestsMessage || "");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSmartRequestsAvailable(false);
        setSmartRequestsMessage("Smart Requests are unavailable until the backend confirms contract configuration.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!smartRequestsAvailable && paymentMode !== "standard") {
      setPaymentMode("standard");
      setIsReviewing(false);
    }
  }, [paymentMode, smartRequestsAvailable]);

  useEffect(() => {
    if (paymentMode === "standard") {
      setRecipients((current) => [
        {
          ...(current[0] || createRecipient()),
          percentage: "100",
        },
      ]);
      return;
    }

    setRecipients((current) => {
      if (current.length > 1) {
        return current;
      }

      return [
        {
          ...current[0],
          percentage: "50",
        },
        createRecipient({ percentage: "50" }),
      ];
    });
  }, [paymentMode]);

  const allocation = useMemo(() => {
    try {
      return {
        error: "",
        value: calculateSmartRequestRecipients({ amount: amount || "0", currency, recipients }),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unable to calculate allocations.",
        value: null,
      };
    }
  }, [amount, currency, recipients]);

  const calculatedRecipients = allocation.value?.recipients || recipients.map((recipient) => ({
    ...recipient,
    allocationBps: 0,
    amount: "0",
    amountBaseUnits: "0",
  }));
  const allocationTotal = allocation.value?.totalPercentage || "0";
  const canSubmit = Boolean(ownerEmail && amount && !allocation.error && allocation.value?.isFullyAllocated);

  function updateRecipient(id: string, patch: Partial<SmartRequestRecipientDraft>) {
    setRecipients((current) => current.map((recipient) => (recipient.id === id ? { ...recipient, ...patch } : recipient)));
    setIsReviewing(false);
  }

  function addRecipient() {
    setRecipients((current) => {
      if (current.length >= SMART_REQUEST_MAX_RECIPIENTS) {
        return current;
      }

      return [...current, createRecipient({ percentage: "0" })];
    });
    setIsReviewing(false);
  }

  function removeRecipient(id: string) {
    setRecipients((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((recipient) => recipient.id !== id);
    });
    setIsReviewing(false);
  }

  function handleModeChange(mode: SmartRequestMode) {
    if (mode !== "standard" && !smartRequestsAvailable) {
      setState({
        status: "error",
        message: smartRequestsMessage || "Smart Requests are unavailable until the VeloxPayRequests contract is configured.",
      });
      return;
    }

    setPaymentMode(mode);
    setIsReviewing(false);
    setState({ status: "idle" });
  }

  async function handleCopyLink() {
    if (!state.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "idle" });

    try {
      const validated = paymentMode === "standard"
        ? calculateSmartRequestRecipients({ amount, currency, recipients })
        : validateSmartRequestDraft({
            mode: paymentMode,
            amount,
            currency,
            recipients,
            dueDate,
            refundEligibilityDate,
          });

      if (!ownerEmail) {
        throw new Error("Your wallet email is required.");
      }

      if (!isReviewing) {
        setIsReviewing(true);
        return;
      }

      setIsPending(true);

      if (paymentMode === "standard") {
        const paymentLink = await createPaymentLink({
          amount,
          description: description || undefined,
          ownerEmail,
          ownerName: ownerName || undefined,
          walletSessionToken: walletUser?.sessionToken || undefined,
          currency,
          recurrence,
          customerEmail: customerEmail || undefined,
          customerName: customerName || undefined,
        });

        if (ownerEmail) {
          localStorage.setItem(OWNER_EMAIL_KEY, ownerEmail);
          syncOwnerCookies(ownerEmail, ownerName);
          upsertStoredPaymentLink(ownerEmail, paymentLink);
        }

        if (ownerName) {
          localStorage.setItem(OWNER_NAME_KEY, ownerName);
        }

        setState({
          status: "success",
          message: "Payment link created successfully.",
          url: paymentLink.url,
          paymentLink,
        });
        setCopied(false);
        router.refresh();
        onCreated?.(paymentLink);
        return;
      }

      const response = await createSmartRequest({
        amount,
        description: description || undefined,
        ownerEmail,
        ownerName: ownerName || undefined,
        walletSessionToken: walletUser?.sessionToken || undefined,
        currency,
        customerEmail: customerEmail || undefined,
        customerName: customerName || undefined,
        paymentMode,
        recipients: validated.recipients,
        deliverableDescription: deliverableDescription || undefined,
        dueDate: dueDate || undefined,
        refundEligibilityDate: refundEligibilityDate || undefined,
      });

      localStorage.setItem(OWNER_EMAIL_KEY, ownerEmail);
      syncOwnerCookies(ownerEmail, ownerName);
      upsertStoredPaymentLink(ownerEmail, response.paymentLink);

      if (ownerName) {
        localStorage.setItem(OWNER_NAME_KEY, ownerName);
      }

      setState({
        status: "success",
        message: `${paymentMode === "split" ? "Split payment" : "Protected payment"} request created successfully.`,
        url: response.paymentLink.url,
        paymentLink: response.paymentLink,
        smartRequest: response.smartRequest,
      });
      setCopied(false);
      router.refresh();
      onCreated?.(response.paymentLink);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to create payment request.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className={compact ? "" : "max-w-2xl"}>
      <h2 className="text-xl font-semibold text-slate-900">Create a payment request</h2>
      <p className="mt-2 text-sm text-slate-600">
        {walletUser?.email
          ? "Your wallet is already connected, so you can create an invoice-style payment request in seconds."
          : "Add your wallet email once and we&apos;ll remember it here for the next payment request you create."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { id: "standard", label: "Standard", detail: "One payer, one settlement path." },
              { id: "split", label: "Split Payment", detail: "Distribute funds across recipients." },
              { id: "protected", label: "Protected Payment", detail: "Hold funds until approval." },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.id !== "standard" && !smartRequestsAvailable}
                onClick={() => handleModeChange(option.id as SmartRequestMode)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  paymentMode === option.id
                    ? "border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-100"
                    : option.id !== "standard" && !smartRequestsAvailable
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span>
              </button>
            ))}
          </div>
          {!smartRequestsAvailable && smartRequestsMessage ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {smartRequestsMessage}
            </p>
          ) : null}
        </section>

        {walletUser?.email ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">
              Creating payment requests as {ownerName || walletUser.email}
            </div>
            <div className="mt-1 text-sm text-slate-500">{ownerEmail}</div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Wallet email" hint="Use the same email you used to create or restore your wallet.">
              <input
                type="email"
                placeholder="you@example.com"
                value={ownerEmail}
                onChange={(event) => {
                  setOwnerEmail(event.target.value);
                  setIsReviewing(false);
                }}
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>

            <Field label="Name" hint="Shown on the payment request.">
              <input
                type="text"
                placeholder="Smart"
                value={ownerName}
                onChange={(event) => {
                  setOwnerName(event.target.value);
                  setIsReviewing(false);
                }}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
          </div>
        )}

        {customers.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-medium text-slate-900">Recent customers</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {customers.slice(0, 6).map((customer) => (
                <button
                  key={customer.email}
                  type="button"
                  onClick={() => {
                    setCustomerEmail(customer.email);
                    setCustomerName(customer.name || "");
                    setIsReviewing(false);
                  }}
                  className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  {customer.name || customer.email}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Field label="Amount" hint="Required. This is the amount the payer will see right away.">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <input
              type="text"
              placeholder="500"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setIsReviewing(false);
              }}
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <select
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value as PaymentCurrency);
                setIsReviewing(false);
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="USDC">USDC on Arc</option>
              <option value="EURC">EURC on Arc</option>
            </select>
          </div>
        </Field>

        <Field label="Description" hint="Tell the payer exactly what this request is for.">
          <textarea
            rows={4}
            placeholder="Website design invoice"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setIsReviewing(false);
            }}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Customer email" hint="Optional. Save a specific payer on this request.">
            <input
              type="email"
              placeholder="client@example.com"
              value={customerEmail}
              onChange={(event) => {
                setCustomerEmail(event.target.value);
                setIsReviewing(false);
              }}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="Customer name" hint="Optional. Helpful for named invoices.">
            <input
              type="text"
              placeholder="Acme team"
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value);
                setIsReviewing(false);
              }}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>
        </div>

        {paymentMode === "standard" ? (
          <Field label="Billing cadence" hint="Recurring requests stay reusable for weekly or monthly collections.">
            <select
              value={recurrence}
              onChange={(event) => {
                setRecurrence(event.target.value);
                setIsReviewing(false);
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="one-time">One-time request</option>
              <option value="weekly">Weekly recurring request</option>
              <option value="monthly">Monthly recurring request</option>
            </select>
          </Field>
        ) : null}

        {paymentMode !== "standard" ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recipients</h3>
                <p className="mt-1 text-xs text-slate-500">Allocations must total exactly 100% before you can continue.</p>
              </div>
              <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                allocation.value?.isFullyAllocated ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {allocationTotal}% allocated
              </div>
            </div>

            <div className="space-y-3">
              {calculatedRecipients.map((recipient, index) => (
                <div key={recipient.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Recipient {index + 1}</div>
                    {recipients.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRecipient(recipient.id)}
                        className="text-sm font-medium text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={recipient.name}
                      onChange={(event) => updateRecipient(recipient.id, { name: event.target.value })}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    <input
                      type="text"
                      placeholder="Role"
                      value={recipient.role}
                      onChange={(event) => updateRecipient(recipient.id, { role: event.target.value })}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={recipient.email}
                      onChange={(event) => updateRecipient(recipient.id, { email: event.target.value })}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    <input
                      type="text"
                      placeholder="0x wallet address"
                      value={recipient.walletAddress}
                      onChange={(event) => updateRecipient(recipient.id, { walletAddress: event.target.value })}
                      required
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    <input
                      type="text"
                      placeholder="Percentage"
                      value={recipient.percentage}
                      onChange={(event) => updateRecipient(recipient.id, { percentage: event.target.value })}
                      required
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {recipient.amount} {currency}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={addRecipient}
              disabled={recipients.length >= SMART_REQUEST_MAX_RECIPIENTS}
            >
              Add recipient
            </Button>
          </section>
        ) : null}

        {paymentMode === "protected" ? (
          <section className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-sm leading-6 text-brand-900">
              Protected payments are held by the Arc smart contract until the payer approves release after delivery.
            </p>
            <Field label="Deliverable description">
              <textarea
                rows={3}
                value={deliverableDescription}
                onChange={(event) => {
                  setDeliverableDescription(event.target.value);
                  setIsReviewing(false);
                }}
                placeholder="Describe what must be delivered before funds are released."
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Completion deadline">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => {
                    setDueDate(event.target.value);
                    setIsReviewing(false);
                  }}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </Field>
              <Field label="Refund eligibility date">
                <input
                  type="date"
                  value={refundEligibilityDate}
                  onChange={(event) => {
                    setRefundEligibilityDate(event.target.value);
                    setIsReviewing(false);
                  }}
                  required
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </Field>
            </div>
          </section>
        ) : null}

        {allocation.error ? <p className="text-sm text-rose-600">{allocation.error}</p> : null}

        {isReviewing ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Review request</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div>Total: {amount || "0"} {currency}</div>
              <div>Payment mode: {paymentMode === "standard" ? "Standard" : paymentMode === "split" ? "Split Payment" : "Protected Payment"}</div>
              <div>Deadline: {paymentMode === "protected" ? dueDate : "Not required"}</div>
              <div>Estimated network fee: calculated at payment time</div>
            </div>
            <div className="mt-4 space-y-2">
              {calculatedRecipients.map((recipient) => (
                <div key={recipient.id} className="flex flex-col rounded-xl bg-white px-3 py-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <span>{recipient.name || recipient.email || "Recipient"} · {recipient.percentage}%</span>
                  <span>{recipient.amount} {currency}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{contractBehaviourForMode(paymentMode)}</p>
          </section>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={isPending || (!isReviewing && !canSubmit)}>
            {isPending ? "Creating..." : isReviewing ? "Confirm and create" : "Review request"}
          </Button>
          {isReviewing ? (
            <Button type="button" variant="secondary" onClick={() => setIsReviewing(false)}>
              Edit details
            </Button>
          ) : null}
        </div>
      </form>

      {state.message ? (
        <div
          className={`mt-5 rounded-2xl p-4 text-sm ${
            state.status === "success"
              ? "bg-emerald-50 text-emerald-800 dark:border dark:border-emerald-800/50 dark:bg-emerald-950/70 dark:text-emerald-100"
              : "bg-rose-50 text-rose-700 dark:border dark:border-rose-800/50 dark:bg-rose-950/70 dark:text-rose-100"
          }`}
        >
          <p>{state.message}</p>
          {state.url ? (
            <>
              <p className="mt-2 text-sm">Your request is ready. Send this link to the person who should pay you.</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <p className="min-w-0 flex-1 break-all font-medium text-slate-800 dark:text-emerald-50">{state.url}</p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-950 dark:text-white dark:ring-emerald-700 dark:hover:bg-slate-900"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800/70">
                {state.smartRequest
                  ? "This Smart Request is saved and ready for on-chain execution when the payer starts checkout."
                  : "The payer opens the link, confirms the amount, and completes the payment from one page."}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
