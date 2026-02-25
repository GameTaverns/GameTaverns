import { useState, useEffect, useRef } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";

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
 * Supports swipe-to-dismiss on touch devices.
 */
export function FeatureTip({ tipId, title, description, icon, className }: FeatureTipProps) {
  const [visible, setVisible] = useState(() => {
    // Initialize synchronously from localStorage to prevent flash
    return !localStorage.getItem(`tip_dismissed_${tipId}`);
  });
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0, 1, 0]);

  const dismiss = () => {
    localStorage.setItem(`tip_dismissed_${tipId}`, "true");
    setVisible(false);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: 200 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
          style={{ x, opacity }}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm cursor-grab active:cursor-grabbing touch-pan-y",
            className
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {icon || <Info className="h-4 w-4 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
            <p className="text-muted-foreground/50 text-[10px] mt-1 sm:hidden">Swipe to dismiss</p>
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
