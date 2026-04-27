import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-[#1e2230] bg-[#0f1117] px-4 text-sm text-slate-100 outline-none focus:border-[#0d9488]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
