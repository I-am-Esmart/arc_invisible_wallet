import type { PaymentCurrency } from "@/lib/types/payment-link";
import { isAddress } from "viem";

export type SmartRequestMode = "standard" | "split" | "protected";

export type SmartRequestRecipientDraft = {
  id: string;
  name: string;
  role: string;
  email: string;
  walletAddress: string;
  percentage: string;
};

export type SmartRequestRecipientAllocation = SmartRequestRecipientDraft & {
  allocationBps: number;
  amount: string;
  amountBaseUnits: string;
};

export const SMART_REQUEST_MAX_RECIPIENTS = 10;
export const SMART_REQUEST_BASIS_POINTS = 10_000;

const TOKEN_DECIMALS: Record<PaymentCurrency, number> = {
  USDC: 6,
  EURC: 6,
};

export function tokenDecimals(currency: PaymentCurrency) {
  return TOKEN_DECIMALS[currency];
}

export function parseTokenAmountToBaseUnits(amount: string, decimals: number) {
  const normalized = amount.trim();

  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalized)) {
    throw new Error("Amount must be a positive decimal value.");
  }

  const [whole, fraction = ""] = normalized.split(".");

  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }

  const baseUnits =
    BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt((fraction || "").padEnd(decimals, "0") || "0");

  if (baseUnits <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }

  return baseUnits.toString();
}

export function formatBaseUnits(baseUnits: string, decimals: number) {
  const units = BigInt(baseUnits);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = units / scale;
  const fraction = units % scale;

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

export function parsePercentageToBps(percentage: string) {
  const normalized = percentage.trim();

  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Percentages can use at most two decimal places.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");

  if (!Number.isInteger(bps) || bps < 0 || bps > SMART_REQUEST_BASIS_POINTS) {
    throw new Error("Each percentage must be between 0 and 100.");
  }

  return bps;
}

export function bpsToPercentage(bps: number) {
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  return fraction ? `${whole}.${String(fraction).padStart(2, "0").replace(/0+$/, "")}` : String(whole);
}

export function calculateSmartRequestRecipients({
  amount,
  currency,
  recipients,
}: {
  amount: string;
  currency: PaymentCurrency;
  recipients: SmartRequestRecipientDraft[];
}) {
  if (!recipients.length || recipients.length > SMART_REQUEST_MAX_RECIPIENTS) {
    throw new Error("Add between 1 and 10 recipients.");
  }

  const decimals = tokenDecimals(currency);
  const amountBaseUnits = parseTokenAmountToBaseUnits(amount, decimals);
  const totalAmount = BigInt(amountBaseUnits);
  let remaining = totalAmount;
  let totalBps = 0;

  const calculated = recipients.map((recipient, index) => {
    const allocationBps = parsePercentageToBps(recipient.percentage);
    totalBps += allocationBps;
    const isLast = index === recipients.length - 1;
    const recipientAmount = isLast
      ? remaining
      : (totalAmount * BigInt(allocationBps)) / BigInt(SMART_REQUEST_BASIS_POINTS);
    remaining -= recipientAmount;

    return {
      ...recipient,
      allocationBps,
      amountBaseUnits: recipientAmount.toString(),
      amount: formatBaseUnits(recipientAmount.toString(), decimals),
    };
  });

  return {
    amountBaseUnits,
    totalBps,
    totalPercentage: bpsToPercentage(totalBps),
    isFullyAllocated: totalBps === SMART_REQUEST_BASIS_POINTS,
    recipients: calculated,
  };
}

export function validateSmartRequestDraft({
  mode,
  amount,
  currency,
  recipients,
  dueDate,
  refundEligibilityDate,
}: {
  mode: SmartRequestMode;
  amount: string;
  currency: PaymentCurrency;
  recipients: SmartRequestRecipientDraft[];
  dueDate?: string;
  refundEligibilityDate?: string;
}) {
  const allocation = calculateSmartRequestRecipients({ amount, currency, recipients });

  if (mode === "standard" && recipients.length !== 1) {
    throw new Error("Standard requests use exactly one recipient.");
  }

  if (!allocation.isFullyAllocated) {
    throw new Error("Recipient allocations must total exactly 100%.");
  }

  for (const recipient of recipients) {
    if (!recipient.walletAddress.trim()) {
      throw new Error("Each recipient needs a wallet address.");
    }

    if (!isAddress(recipient.walletAddress.trim())) {
      throw new Error("Each recipient wallet address must be valid.");
    }
  }

  if (mode === "protected") {
    if (!dueDate) {
      throw new Error("Protected requests need a completion deadline.");
    }

    if (!refundEligibilityDate) {
      throw new Error("Protected requests need a refund eligibility date.");
    }
  }

  return allocation;
}
