import type { ReactNode } from "react";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "new" | "danger" }) {
  const tones = {
    default: "bg-brand-soft text-brand",
    new: "bg-accent text-white",
    danger: "bg-red-100 text-red-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${tones[tone]}`}>{children}</span>;
}
