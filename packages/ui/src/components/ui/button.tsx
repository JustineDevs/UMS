import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent bg-clip-padding text-sm font-medium transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 outline-none select-none motion-safe:active:scale-[0.96] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:opacity-90",
        destructive: "bg-error text-on-error hover:opacity-90",
        outline:
          "border border-outline bg-transparent hover:bg-surface-container-low",
        secondary: "border border-outline bg-secondary text-on-secondary hover:bg-surface-container-low",
        ghost: "hover:bg-surface-container-low",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "size-10",
        "icon-xs": "size-6 rounded-lg",
        "icon-sm": "size-7 rounded-lg",
        "icon-lg": "size-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, type = "button", ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        className: cn(classes, (children.props as { className?: string }).className),
        ref,
      } as React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> });
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
