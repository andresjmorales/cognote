import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-surface rounded-2xl border border-border shadow-sm
          ${paddingClasses[padding]}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";
