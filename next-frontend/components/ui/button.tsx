import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  asChild?: false;
};

type ButtonLinkProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  asChild: true;
} & ComponentProps<typeof Link>;

function getButtonClasses(variant: NonNullable<ButtonProps["variant"]> = "primary") {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };

  return `${base} ${variants[variant]}`;
}

export function Button(props: ButtonProps | ButtonLinkProps) {
  const { className, variant = "primary" } = props;
  const classes = `${getButtonClasses(variant)} ${className || ""}`.trim();

  if ("asChild" in props && props.asChild) {
    const { asChild, children, variant: _variant, className: _className, ...linkProps } = props;
    return (
      <Link {...linkProps} className={classes}>
        {children}
      </Link>
    );
  }

  const { children, type = "button", disabled, onClick } = props;
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
