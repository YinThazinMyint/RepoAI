import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[#1e2230] bg-[#0f1117] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#0d9488]",
        className,
      )}
      {...props}
    />
  );
}
