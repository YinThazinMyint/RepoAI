"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:pointer-events-none disabled:opacity-60",
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
        default: "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
        ghost: "bg-transparent text-[#52627a] hover:bg-[#edf6ff] hover:text-[#2563eb]",
        outline: "border-[#d7e7f7] bg-white text-[#172033] hover:border-[#38bdf8] hover:bg-[#f8fbff]",
        secondary: "bg-[#0ea5e9] text-white hover:bg-[#0284c7]",
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
