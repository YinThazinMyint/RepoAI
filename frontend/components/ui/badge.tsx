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
        accent: "border-sky-200 bg-sky-50 text-sky-700",
        error: "border-red-200 bg-red-50 text-red-700",
        muted: "border-[#d7e7f7] bg-[#f8fbff] text-[#52627a]",
        success: "border-green-200 bg-green-50 text-green-700",
        teal: "border-blue-200 bg-blue-50 text-blue-700",
        warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
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
