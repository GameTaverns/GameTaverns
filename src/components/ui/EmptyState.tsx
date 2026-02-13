import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
  /** Use "dark" variant for dashboard (wood theme), "light" for library views */
  variant?: "light" | "dark";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  onSecondaryAction,
  className,
  variant = "light",
}: EmptyStateProps) {
  const isDark = variant === "dark";

  const PrimaryWrapper = actionHref ? "a" : "button";
  const SecondaryWrapper = secondaryHref ? "a" : "button";

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className={cn(
        "flex h-16 w-16 items-center justify-center rounded-2xl mb-4",
        isDark ? "bg-secondary/10" : "bg-muted"
      )}>
        <Icon className={cn(
          "h-8 w-8",
          isDark ? "text-secondary/60" : "text-muted-foreground/60"
        )} />
      </div>
      
      <h3 className={cn(
        "font-display text-xl font-semibold mb-2",
        isDark ? "text-cream" : "text-foreground"
      )}>
        {title}
      </h3>
      
      <p className={cn(
        "text-sm max-w-md mb-6",
        isDark ? "text-cream/60" : "text-muted-foreground"
      )}>
        {description}
      </p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {actionLabel && (
          <PrimaryWrapper
            {...(actionHref ? { href: actionHref } : { onClick: onAction })}
          >
            <Button className={isDark ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : ""}>
              {actionLabel}
            </Button>
          </PrimaryWrapper>
        )}
        
        {secondaryLabel && (
          <SecondaryWrapper
            {...(secondaryHref ? { href: secondaryHref } : { onClick: onSecondaryAction })}
          >
            <Button variant="outline" className={isDark ? "border-cream/20 text-cream" : ""}>
              {secondaryLabel}
            </Button>
          </SecondaryWrapper>
        )}
      </div>
    </div>
  );
}
