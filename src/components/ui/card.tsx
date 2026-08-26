import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — the single surface primitive for the elegant system.
 * Light paper surface, hairline border, soft elevation. Variants:
 *  - default: raised card
 *  - sunken: recessed inset (use for nested groups)
 *  - ghost: borderless, just padding
 *  - interactive: hover elevation + pointer
 *  - glass: glass-token surface (absorbs the old GlassPanel)
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "sunken" | "ghost" | "interactive" | "glass";
    padding?: "none" | "sm" | "md" | "lg";
  }
>(({ className, variant = "default", padding, ...props }, ref) => {
  const variants: Record<string, string> = {
    default: "bg-card border border-border shadow-elevation-soft",
    sunken: "bg-surface-sunken border border-border/70",
    ghost: "bg-transparent",
    interactive:
      "bg-card border border-border shadow-elevation-soft transition-[box-shadow,border-color,transform] hover:border-border-strong hover:shadow-elevation-card hover:-translate-y-0.5 motion-reduce:hover:transform-none",
    glass:
      "border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)] rounded-[14px]",
  };
  const paddings: Record<string, string> = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-8",
  };
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-card text-ink",
        variants[variant],
        padding ? paddings[padding] : null,
        className,
      )}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col gap-1.5 border-b border-border/70 px-5 py-4 sm:px-6 sm:py-5",
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-heading text-lg font-bold tracking-[-0.02em] text-ink",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-relaxed text-ink-secondary", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-5 py-4 sm:px-6 sm:py-5", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-3 border-t border-border/70 px-5 py-4 sm:px-6",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
