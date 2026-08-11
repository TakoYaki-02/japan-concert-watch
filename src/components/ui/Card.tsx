import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={`rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgba(31,54,45,0.06)] ${className}`} {...props} />;
}
