import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl border border-[#1e2230] bg-[#0f1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#0d9488]",
        className,
      )}
      {...props}
    />
  );
}
