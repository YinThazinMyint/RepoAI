"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border border-transparent text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40 disabled:pointer-events-none disabled:opacity-60",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-11 px-4 py-2",
        icon: "h-10 w-10",
        lg: "h-12 px-5 text-sm",
        sm: "h-9 px-3 text-xs",
      },
      variant: {
        default: "bg-[#0d9488] text-white hover:bg-[#0f766e]",
        ghost: "bg-transparent text-white hover:bg-white/5",
        outline: "border-[#1e2230] bg-[#13161e] text-slate-200 hover:bg-[#171b24]",
        secondary: "bg-[#7c3aed] text-white hover:bg-[#6d28d9]",
      },
    },
  },
);

type ButtonProps = HTMLMotionProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      className={cn(buttonVariants({ size, variant }), className)}
      {...props}
    />
  );
}
