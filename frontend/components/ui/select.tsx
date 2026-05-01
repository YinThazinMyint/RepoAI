import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 text-sm text-[#172033] outline-none focus:border-[#38bdf8] focus:bg-white",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
