export function formatMoney(amount: string, currency: string) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${currency}`;
  }

  return `${numericAmount.toFixed(2)} ${currency}`;
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}
