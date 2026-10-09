import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#C5533B] text-white shadow",
        secondary:
          "border-transparent bg-stone-100 text-stone-900",
        destructive:
          "border-transparent bg-[#FCEDED] text-[#B94B4B]",
        outline: "text-stone-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
