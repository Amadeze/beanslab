import Link from "next/link";
import { type VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { DOMAIN_TONE_CLASSES, type DomainTone } from "@/lib/workflow";

type NextActionProps = {
  label: string;
  tone?: DomainTone;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: VariantProps<typeof buttonVariants>["size"];
  icon?: React.ReactNode;
  title?: string;
  className?: string;
};

/**
 * The single, reusable "Next Action" CTA. Every operational entity surfaces
 * its next useful action through this primitive so the action language is
 * consistent across modules (state-aware, one primary CTA per row).
 *
 * - `href`    ΓåÆ renders as a Link (navigation action)
 * - `onClick` ΓåÆ renders as a Button (in-page action / opens a dialog)
 */
export function NextAction({
  label,
  tone = "neutral",
  href,
  onClick,
  disabled,
  size = "xs",
  icon,
  title,
  className,
}: NextActionProps) {
  const cls = `font-bold uppercase tracking-wide shadow-sm ${DOMAIN_TONE_CLASSES[tone]} ${className ?? ""}`;

  if (href) {
    return (
      <Button
        render={<Link href={href} />}
        size={size}
        disabled={disabled}
        title={title}
        className={cls}
      >
        {icon ? <span className="mr-1 inline-flex">{icon}</span> : null}
        {label}
      </Button>
    );
  }

  return (
    <Button size={size} onClick={onClick} disabled={disabled} title={title} className={cls}>
      {icon ? <span className="mr-1 inline-flex">{icon}</span> : null}
      {label}
    </Button>
  );
}

