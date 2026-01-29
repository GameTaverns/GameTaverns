import { useState, useCallback } from "react";
import { Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QuadrantFilter } from "./QuadrantFilter";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface QuadrantFilterButtonProps {
  onFilterChange: (filters: { difficulty: number; playTime: number; intensity: number } | null) => void;
  className?: string;
}

export function QuadrantFilterButton({ onFilterChange, className }: QuadrantFilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasActiveFilter, setHasActiveFilter] = useState(false);
  const isMobile = useIsMobile();

  const handleFilterChange = useCallback((filters: { difficulty: number; playTime: number; intensity: number }) => {
    // Only mark as active if moved from center
    const isActive = Math.abs(filters.difficulty - 0.5) > 0.1 || Math.abs(filters.playTime - 0.5) > 0.1;
    setHasActiveFilter(isActive);
    onFilterChange(isActive ? filters : null);
  }, [onFilterChange]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Only show on mobile by default, but allow desktop for testing
  if (!isMobile && !className?.includes("force-show")) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          hasActiveFilter 
            ? "w-14 h-14 bottom-24 right-4" 
            : "w-14 h-14 bottom-24 right-4",
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Compass className="h-6 w-6" />
        
        {/* Active indicator */}
        <AnimatePresence>
          {hasActiveFilter && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background"
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Quadrant Filter Overlay */}
      <QuadrantFilter
        isOpen={isOpen}
        onClose={handleClose}
        onFilterChange={handleFilterChange}
      />
    </>
  );
}
