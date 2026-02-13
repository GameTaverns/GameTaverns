import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FeatureTipProps {
  /** Unique key for localStorage persistence */
  tipId: string;
  /** Short title for the tip */
  title: string;
  /** Description text */
  description: string;
  /** Optional icon override */
  icon?: React.ReactNode;
  /** Placement relative to the wrapped element */
  className?: string;
}

/**
 * A dismissible inline tip that only shows once per user.
 * Wrap around or place next to a feature to explain it.
 */
export function FeatureTip({ tipId, title, description, icon, className }: FeatureTipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`tip_dismissed_${tipId}`);
    if (!dismissed) {
      // Small delay so it feels contextual, not instant
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tipId]);

  const dismiss = () => {
    localStorage.setItem(`tip_dismissed_${tipId}`, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm",
            className
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {icon || <Info className="h-4 w-4 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
            aria-label="Dismiss tip"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
