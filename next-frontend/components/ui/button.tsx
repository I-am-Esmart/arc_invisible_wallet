import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
  asChild?: boolean;
};

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

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  asChild = false,
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
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

export { Link };
