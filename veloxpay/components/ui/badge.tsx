import { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "neutral" | "error";

const variants: Record<BadgeVariant, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  neutral: "bg-slate-100 text-slate-700",
  error: "bg-rose-100 text-rose-700",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
