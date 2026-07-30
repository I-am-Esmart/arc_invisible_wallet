"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  CreditCard,
  Lock,
  ReceiptText,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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

type ModeOption = {
  id: SmartRequestMode;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const OWNER_EMAIL_KEY = "veloxpay_owner_email";
const OWNER_NAME_KEY = "veloxpay_owner_name";
const DEFAULT_RECIPIENT_ID = "recipient-1";

const WIZARD_STEPS = [
  "Payment Details",
  "Payment Mode",
  "Recipients",
  "Protection Settings",
  "Review",
];

const MODE_OPTIONS: ModeOption[] = [
  { id: "standard", label: "Standard", detail: "Simple payment.", icon: CreditCard },
  { id: "split", label: "Split", detail: "Automatically distribute funds.", icon: Users },
  { id: "protected", label: "Protected", detail: "Hold funds until approval.", icon: Shield },
];

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

function modeLabel(mode: SmartRequestMode) {
  if (mode === "split") {
    return "Split Payment";
  }

  if (mode === "protected") {
    return "Protected Payment";
  }

  return "Standard";
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
  const [wizardStep, setWizardStep] = useState(1);
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
  const canContinueFromDetails = Boolean(ownerEmail && amount);

  function markChanged() {
    setIsReviewing(false);
    if (wizardStep === 5) {
      setWizardStep(1);
    }
  }

  function updateRecipient(id: string, patch: Partial<SmartRequestRecipientDraft>) {
    setRecipients((current) => current.map((recipient) => (recipient.id === id ? { ...recipient, ...patch } : recipient)));
    markChanged();
  }

  function addRecipient() {
    setRecipients((current) => {
      if (current.length >= SMART_REQUEST_MAX_RECIPIENTS) {
        return current;
      }

      return [...current, createRecipient({ percentage: "0" })];
    });
    markChanged();
  }

  function removeRecipient(id: string) {
    setRecipients((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((recipient) => recipient.id !== id);
    });
    markChanged();
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

  function goToStep(step: number) {
    setWizardStep(step);
    setIsReviewing(step === 5);
  }

  function goNext() {
    goToStep(Math.min(5, wizardStep + 1));
  }

  function goBack() {
    goToStep(Math.max(1, wizardStep - 1));
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
        setWizardStep(5);
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
    <Card className={compact ? "vp-panel" : "vp-shell max-w-4xl"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="vp-eyebrow">Request builder</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink-heading">Create Smart Request</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-body">
            Build a payment link step by step, then review the settlement rules before creation.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-ink-body">
          Step {wizardStep} of 5
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-5">
        {WIZARD_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = wizardStep === stepNumber;
          const isDone = wizardStep > stepNumber;

          return (
            <button
              key={step}
              type="button"
              onClick={() => goToStep(stepNumber)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-[0_10px_30px_rgba(37,99,235,0.12)] ring-2 ring-brand-100"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-line bg-white text-ink-muted hover:border-brand-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <CheckCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span className="text-xs font-semibold">0{stepNumber}</span>
                )}
                <span className="text-xs font-semibold leading-4">{step}</span>
              </div>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {wizardStep === 1 ? (
          <section className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
              <Field label="Amount" hint="The amount the payer will see at checkout.">
                <input
                  type="text"
                  placeholder="1000"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    markChanged();
                  }}
                  required
                  className="vp-control text-lg"
                />
              </Field>
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(event) => {
                    setCurrency(event.target.value as PaymentCurrency);
                    markChanged();
                  }}
                  className="vp-control"
                >
                  <option value="USDC">USDC on Arc</option>
                  <option value="EURC">EURC on Arc</option>
                </select>
              </Field>
            </div>

            <Field label="Description" hint="Keep it short and clear for the payer.">
              <textarea
                rows={4}
                placeholder="Website development milestone"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  markChanged();
                }}
                className="vp-control"
              />
            </Field>

            {walletUser?.email ? (
              <div className="vp-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-line">
                    <Wallet className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-heading">
                      Creating as {ownerName || walletUser.email}
                    </div>
                    <div className="mt-1 break-all text-sm text-ink-muted">{ownerEmail}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Wallet email" hint="Use the email tied to your VeloxPay wallet.">
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={ownerEmail}
                    onChange={(event) => {
                      setOwnerEmail(event.target.value);
                      markChanged();
                    }}
                    required
                    className="vp-control"
                  />
                </Field>
                <Field label="Name" hint="Shown on the request.">
                  <input
                    type="text"
                    placeholder="Smart"
                    value={ownerName}
                    onChange={(event) => {
                      setOwnerName(event.target.value);
                      markChanged();
                    }}
                    className="vp-control"
                  />
                </Field>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Customer email" hint="Optional. Saves a payer on this request.">
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={customerEmail}
                  onChange={(event) => {
                    setCustomerEmail(event.target.value);
                    markChanged();
                  }}
                  className="vp-control"
                />
              </Field>
              <Field label="Customer name" hint="Optional. Useful for receipts.">
                <input
                  type="text"
                  placeholder="Acme team"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    markChanged();
                  }}
                  className="vp-control"
                />
              </Field>
            </div>

            {customers.length ? (
              <div className="vp-panel">
                <div className="text-sm font-semibold text-ink-heading">Recent customers</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customers.slice(0, 6).map((customer) => (
                    <button
                      key={customer.email}
                      type="button"
                      onClick={() => {
                        setCustomerEmail(customer.email);
                        setCustomerName(customer.name || "");
                        markChanged();
                      }}
                      className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-ink-body transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      {customer.name || customer.email}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {paymentMode === "standard" ? (
              <Field label="Billing cadence" hint="Optional recurring cadence for reusable requests.">
                <select
                  value={recurrence}
                  onChange={(event) => {
                    setRecurrence(event.target.value);
                    markChanged();
                  }}
                  className="vp-control"
                >
                  <option value="one-time">One-time request</option>
                  <option value="weekly">Weekly recurring request</option>
                  <option value="monthly">Monthly recurring request</option>
                </select>
              </Field>
            ) : null}
          </section>
        ) : null}

        {wizardStep === 2 ? (
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink-heading">Choose payment mode</h3>
              <p className="mt-2 text-sm text-ink-body">Select how this request should settle.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const disabled = option.id !== "standard" && !smartRequestsAvailable;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleModeChange(option.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      paymentMode === option.id
                        ? "border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-100"
                        : disabled
                          ? "cursor-not-allowed border-line bg-slate-50 text-slate-400"
                          : "border-line bg-white text-ink-body hover:border-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-line">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="mt-5 text-lg font-semibold">{option.label}</div>
                    <p className="mt-2 text-sm leading-6 text-ink-body">{option.detail}</p>
                  </button>
                );
              })}
            </div>
            {!smartRequestsAvailable && smartRequestsMessage ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {smartRequestsMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {wizardStep === 3 ? (
          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink-heading">Recipients</h3>
                <p className="mt-2 text-sm text-ink-body">Allocations must total exactly 100%.</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                allocation.value?.isFullyAllocated ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {allocationTotal}% allocated
              </div>
            </div>

            <div className="grid gap-4">
              {calculatedRecipients.map((recipient, index) => (
                <div key={recipient.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-ink-muted">Recipient {index + 1}</div>
                      <div className="mt-1 text-xl font-semibold text-ink-heading">
                        {recipient.name || recipient.role || "New recipient"}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-semibold text-ink-heading">{recipient.percentage || "0"}%</div>
                      <div className="text-sm text-ink-muted">{recipient.amount} {currency}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <input type="text" placeholder="Name" value={recipient.name} onChange={(event) => updateRecipient(recipient.id, { name: event.target.value })} className="vp-control" />
                    <input type="text" placeholder="Role" value={recipient.role} onChange={(event) => updateRecipient(recipient.id, { role: event.target.value })} className="vp-control" />
                    <input type="email" placeholder="Email" value={recipient.email} onChange={(event) => updateRecipient(recipient.id, { email: event.target.value })} className="vp-control" />
                    <input type="text" placeholder="0x wallet address" value={recipient.walletAddress} onChange={(event) => updateRecipient(recipient.id, { walletAddress: event.target.value })} required className="vp-control" />
                    <input type="text" placeholder="Allocation %" value={recipient.percentage} onChange={(event) => updateRecipient(recipient.id, { percentage: event.target.value })} required className="vp-control" />
                    <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-ink-body">
                      <span className="font-semibold text-ink-heading">{recipient.amount} {currency}</span>
                    </div>
                  </div>

                  {recipients.length > 1 ? (
                    <button type="button" onClick={() => removeRecipient(recipient.id)} className="mt-4 text-sm font-semibold text-rose-600 hover:text-rose-700">
                      Remove recipient
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {paymentMode !== "standard" ? (
              <Button type="button" variant="secondary" onClick={addRecipient} disabled={recipients.length >= SMART_REQUEST_MAX_RECIPIENTS}>
                Add recipient
              </Button>
            ) : null}
            {allocation.error ? <p className="text-sm text-rose-600">{allocation.error}</p> : null}
          </section>
        ) : null}

        {wizardStep === 4 ? (
          <section className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-ink-heading">Protection Settings</h3>
              <p className="mt-2 text-sm text-ink-body">Define the delivery and refund rules for protected requests.</p>
            </div>

            {paymentMode === "protected" ? (
              <div className="space-y-5 rounded-[24px] border border-brand-200/80 bg-gradient-to-br from-brand-50/80 to-white p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-100">
                    <Lock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-sm leading-6 text-brand-900">
                    Funds are held by the Arc smart contract until the payer approves release after delivery.
                  </p>
                </div>
                <Field label="Deliverable description">
                  <textarea
                    rows={3}
                    value={deliverableDescription}
                    onChange={(event) => {
                      setDeliverableDescription(event.target.value);
                      markChanged();
                      setWizardStep(4);
                    }}
                    placeholder="Describe what must be delivered before funds are released."
                    className="vp-control"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Completion deadline">
                    <input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); markChanged(); setWizardStep(4); }} required className="vp-control" />
                  </Field>
                  <Field label="Refund eligibility date">
                    <input type="date" value={refundEligibilityDate} onChange={(event) => { setRefundEligibilityDate(event.target.value); markChanged(); setWizardStep(4); }} required className="vp-control" />
                  </Field>
                </div>
                <div className="rounded-xl bg-white p-4 text-sm leading-6 text-ink-body ring-1 ring-brand-100">
                  Refund rules follow the onchain contract: the creator can voluntarily refund a funded protected request, and the payer can refund an expired protected request only when no deliverable was submitted before the deadline.
                </div>
              </div>
            ) : (
              <div className="vp-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-line">
                    <ReceiptText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-ink-heading">No escrow rules required</h4>
                    <p className="mt-2 text-sm leading-6 text-ink-body">{contractBehaviourForMode(paymentMode)}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {wizardStep === 5 ? (
          <section className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-ink-heading">Review</h3>
              <p className="mt-2 text-sm text-ink-body">Confirm the payment amount, recipients, mode, and rules.</p>
            </div>
            <div className="vp-soft">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Payment amount</div>
                  <div className="mt-2 text-3xl font-semibold text-ink-heading">{amount || "0"} {currency}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Mode</div>
                  <div className="mt-2 text-lg font-semibold text-ink-heading">{modeLabel(paymentMode)}</div>
                  <p className="mt-1 text-sm leading-6 text-ink-body">{contractBehaviourForMode(paymentMode)}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {calculatedRecipients.map((recipient) => (
                  <div key={recipient.id} className="flex flex-col gap-2 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-ink-heading">{recipient.name || recipient.email || "Recipient"}</div>
                      <div className="mt-1 break-all text-xs text-ink-muted">{recipient.walletAddress || "Wallet address required"}</div>
                    </div>
                    <div className="font-semibold text-ink-heading">{recipient.percentage}% - {recipient.amount} {currency}</div>
                  </div>
                ))}
              </div>
              {paymentMode === "protected" ? (
                <div className="mt-5 rounded-xl bg-white p-4 text-sm leading-6 text-ink-body ring-1 ring-line">
                  Deadline: {dueDate || "Not set"} - Refund eligibility: {refundEligibilityDate || "Not set"}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" onClick={goBack} disabled={wizardStep === 1 || isPending}>
            Back
          </Button>
          {wizardStep < 5 ? (
            <Button type="button" onClick={goNext} disabled={wizardStep === 1 && !canContinueFromDetails}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Creating..." : "Create Request"}
            </Button>
          )}
        </div>
      </form>

      {state.message ? (
        <div className={`mt-5 rounded-[24px] border p-4 text-sm ${
          state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          <p>{state.message}</p>
          {state.url ? (
            <>
              <p className="mt-2 text-sm">Your request is ready. Send this link to the person who should pay you.</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <p className="min-w-0 flex-1 break-all font-medium text-slate-800">{state.url}</p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600 ring-1 ring-emerald-100">
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
