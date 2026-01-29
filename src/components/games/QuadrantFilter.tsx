import { useState, useRef, useCallback, useEffect } from "react";
import { X, Sparkles, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface QuadrantFilterProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterChange: (filters: { difficulty: number; playTime: number; intensity: number }) => void;
}

// Map position (0-1) to difficulty and play time levels
const DIFFICULTY_LABELS = ["Light", "Medium Light", "Medium", "Medium Heavy", "Heavy"];
const PLAYTIME_LABELS = ["Under 30min", "30-60min", "1-2 Hours", "2-3 Hours", "3+ Hours"];

export function QuadrantFilter({ isOpen, onClose, onFilterChange }: QuadrantFilterProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 }); // Center
  const [intensity, setIntensity] = useState(0.5); // How strict the filter is (0-1)
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialIntensity = useRef<number>(0.5);

  // Calculate position from touch/mouse event
  const calculatePosition = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // Calculate pinch distance
  const getPinchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const pos = calculatePosition(e.touches[0].clientX, e.touches[0].clientY);
      if (pos) setPosition(pos);
    } else if (e.touches.length === 2) {
      setIsPinching(true);
      setIsDragging(false);
      initialPinchDistance.current = getPinchDistance(e.touches[0], e.touches[1]);
      initialIntensity.current = intensity;
    }
  }, [calculatePosition, intensity]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (isDragging && e.touches.length === 1) {
      const pos = calculatePosition(e.touches[0].clientX, e.touches[0].clientY);
      if (pos) setPosition(pos);
    } else if (isPinching && e.touches.length === 2) {
      const currentDistance = getPinchDistance(e.touches[0], e.touches[1]);
      if (currentDistance && initialPinchDistance.current) {
        const scale = currentDistance / initialPinchDistance.current;
        // Pinch in = less intensity (broader filter), pinch out = more intensity (stricter filter)
        const newIntensity = Math.max(0.1, Math.min(1, initialIntensity.current * scale));
        setIntensity(newIntensity);
      }
    }
  }, [isDragging, isPinching, calculatePosition]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setIsPinching(false);
    initialPinchDistance.current = null;
  }, []);

  // Mouse support for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    const pos = calculatePosition(e.clientX, e.clientY);
    if (pos) setPosition(pos);
  }, [calculatePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const pos = calculatePosition(e.clientX, e.clientY);
    if (pos) setPosition(pos);
  }, [isDragging, calculatePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel for intensity on desktop
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setIntensity(prev => Math.max(0.1, Math.min(1, prev - e.deltaY * 0.001)));
  }, []);

  // Emit filter changes
  useEffect(() => {
    // Convert position to filter values
    // X: 0 = Light, 1 = Heavy (difficulty)
    // Y: 0 = Short (top), 1 = Long (bottom)
    onFilterChange({
      difficulty: position.x,
      playTime: position.y, // Top = short, bottom = long (no inversion needed)
      intensity,
    });
  }, [position, intensity, onFilterChange]);

  // Get current labels based on position
  const getDifficultyLabel = () => {
    const index = Math.min(4, Math.floor(position.x * 5));
    return DIFFICULTY_LABELS[index];
  };

  const getPlayTimeLabel = () => {
    const index = Math.min(4, Math.floor(position.y * 5));
    return PLAYTIME_LABELS[index];
  };

  // Calculate ring size based on intensity (larger = more lenient)
  const ringSize = 60 + (1 - intensity) * 80; // 60-140px

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          className="relative w-full max-w-sm bg-gradient-to-br from-card via-card to-card/90 rounded-3xl shadow-2xl overflow-hidden border border-primary/20"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Game Finder</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quadrant Area */}
          <div className="p-5">
            {/* Labels - X axis (Difficulty) */}
            <div className="flex justify-between text-xs text-muted-foreground mb-2 px-2">
              <span>Light</span>
              <span className="text-primary font-medium">{getDifficultyLabel()}</span>
              <span>Heavy</span>
            </div>

            {/* Main Quadrant */}
            <div
              ref={containerRef}
              className={cn(
                "relative aspect-square rounded-2xl overflow-hidden cursor-crosshair touch-none select-none",
                "bg-gradient-to-br from-emerald-500/20 via-amber-500/20 to-rose-500/20",
                isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              {/* Gradient zones */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                <div className="bg-gradient-to-br from-emerald-400/40 to-emerald-500/20 flex items-center justify-center">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium opacity-60">
                    Light & Short
                  </span>
                </div>
                <div className="bg-gradient-to-bl from-sky-400/40 to-sky-500/20 flex items-center justify-center">
                  <span className="text-[10px] text-sky-700 dark:text-sky-300 font-medium opacity-60">
                    Heavy & Short
                  </span>
                </div>
                <div className="bg-gradient-to-tr from-amber-400/40 to-amber-500/20 flex items-center justify-center">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium opacity-60">
                    Light & Long
                  </span>
                </div>
                <div className="bg-gradient-to-tl from-rose-400/40 to-rose-500/20 flex items-center justify-center">
                  <span className="text-[10px] text-rose-700 dark:text-rose-300 font-medium opacity-60">
                    Heavy & Long
                  </span>
                </div>
              </div>

              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-foreground/10" />
              </div>

              {/* Selection indicator */}
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  left: `${position.x * 100}%`,
                  top: `${position.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                animate={{
                  scale: isDragging ? 1.1 : 1,
                }}
              >
                {/* Intensity ring */}
                <motion.div
                  className="absolute rounded-full border-2 border-primary/30 bg-primary/5"
                  style={{
                    width: ringSize,
                    height: ringSize,
                    left: -ringSize / 2,
                    top: -ringSize / 2,
                  }}
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                
                {/* Center dot */}
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-primary shadow-lg shadow-primary/50 flex items-center justify-center">
                    <Target className="h-3 w-3 text-primary-foreground" />
                  </div>
                  {/* Pulse effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary"
                    animate={{
                      scale: [1, 1.8],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                </div>
              </motion.div>
            </div>

            {/* Vertical labels - Y axis (Play Time) */}
            <div className="flex justify-between text-xs text-muted-foreground mt-2 px-2">
              <span>Short</span>
              <span className="text-primary font-medium">{getPlayTimeLabel()}</span>
              <span>Long</span>
            </div>

            {/* Intensity indicator */}
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Filter Range:</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                  style={{ width: `${intensity * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-primary w-12 text-right">
                {intensity < 0.3 ? "Broad" : intensity > 0.7 ? "Precise" : "Medium"}
              </span>
            </div>

            {/* Instructions */}
            <p className="text-xs text-muted-foreground text-center mt-4">
              {isMobile ? (
                <>Drag to explore • Pinch to adjust range</>
              ) : (
                <>Click & drag to explore • Scroll to adjust range</>
              )}
            </p>
          </div>

          {/* Apply button */}
          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
