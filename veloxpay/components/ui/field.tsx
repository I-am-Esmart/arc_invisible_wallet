import { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-ink-heading">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-ink-muted">{hint}</span> : null}
    </label>
  );
}
