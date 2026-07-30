import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-6 shadow-card transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(15,23,42,0.08)] ${className}`}>
      {children}
    </div>
  );
}
