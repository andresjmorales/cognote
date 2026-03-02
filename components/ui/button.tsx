import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "success" | "successLight" | "warning" | "error";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark focus:ring-primary/40",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-surface-dim focus:ring-primary/20",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-dim focus:ring-primary/20",
  success:
    "bg-success text-white hover:bg-success/90 focus:ring-success/40",
  successLight:
    "bg-[#8ed491] text-white hover:bg-[#7cc880] focus:ring-success/40",
  warning:
    "bg-warning text-foreground hover:bg-warning/90 focus:ring-warning/40",
  error:
    "bg-error text-white hover:bg-error/90 focus:ring-error/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-base rounded-lg",
  lg: "px-6 py-3 text-lg rounded-xl",
  xl: "px-8 py-4 text-xl rounded-xl min-h-[56px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-150 focus:outline-none focus:ring-2
          disabled:opacity-50 disabled:cursor-not-allowed
          cursor-pointer select-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
