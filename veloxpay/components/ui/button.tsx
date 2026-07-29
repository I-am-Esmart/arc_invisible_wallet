import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  asChild?: boolean;
};

function getButtonClasses(variant: NonNullable<ButtonProps["variant"]> = "primary") {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary: "bg-brand text-white shadow-button hover:bg-brand-hover",
    secondary: "border border-line bg-white text-ink-heading shadow-sm hover:border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-ink-body hover:bg-brand-50 hover:text-brand-700",
  };

  return `${base} ${variants[variant]}`;
}

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  disabled,
  asChild = false,
  ...buttonProps
}: ButtonProps) {
  const classes = `${getButtonClasses(variant)} ${className || ""}`.trim();

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    const childClassName = child.props.className || "";

    return cloneElement(child, {
      className: `${classes} ${childClassName}`.trim(),
    });
  }

  if (asChild) {
    return <span className={classes}>{children}</span>;
  }

  return (
    <button type={type} disabled={disabled} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

export { Link };
