import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileActionBarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A sticky bottom action bar that appears only on mobile.
 * Place key actions here (e.g. "Add Game") for thumb-friendly access.
 */
export function MobileActionBar({ children, className }: MobileActionBarProps) {
  return (
    <div className={cn("mobile-action-bar sm:hidden", className)}>
      <div className="flex items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
