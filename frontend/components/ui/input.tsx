import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 text-sm text-[#172033] outline-none placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white",
        className,
      )}
      {...props}
    />
  );
}
