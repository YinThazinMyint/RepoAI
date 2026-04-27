import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em]",
  {
    defaultVariants: {
      variant: "muted",
    },
    variants: {
      variant: {
        accent: "border-purple-500/20 bg-purple-500/10 text-purple-300",
        error: "border-red-500/20 bg-red-500/10 text-red-300",
        muted: "border-[#1e2230] bg-[#171b24] text-slate-400",
        success: "border-green-500/20 bg-green-500/10 text-green-300",
        teal: "border-teal-500/20 bg-teal-500/10 text-teal-300",
        warning: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
      },
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
