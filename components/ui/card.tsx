import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

const paddingClasses = {
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
