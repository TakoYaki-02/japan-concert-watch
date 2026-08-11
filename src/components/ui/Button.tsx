import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold shadow-sm transition hover:border-brand/40 hover:bg-brand-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 ${className}`} {...props} />;
}
