import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackLinkProps {
  /** Explicit fallback path if there's no browser history */
  fallback?: string;
  /** Override the label (default: "Back") */
  label?: string;
  className?: string;
}

/**
 * Smart back navigation that goes to the previous page (browser back)
 * or falls back to a specified route if there's no history.
 */
export function BackLink({ fallback = "/dashboard", label = "Back", className }: BackLinkProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Use history length > 2 because the initial page load counts as 1
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
