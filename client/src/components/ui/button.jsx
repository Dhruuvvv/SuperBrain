import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-450/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-neutral-50 shadow-sm hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
        destructive:
          "bg-red-500 text-red-50 shadow-sm hover:bg-red-600 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800",
        outline:
          "border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0c0c0e] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 shadow-sm",
        secondary:
          "bg-neutral-100 text-neutral-900 hover:bg-neutral-250 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-850",
        ghost: "hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-900 dark:text-neutral-100",
        link: "text-neutral-900 dark:text-neutral-100 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
