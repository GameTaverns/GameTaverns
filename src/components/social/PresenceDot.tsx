import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/hooks/usePresence";

interface PresenceDotProps {
  status: PresenceStatus;
  className?: string;
  size?: "sm" | "md";
}

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-400",
  offline: "bg-slate-500",
};

const STATUS_RING: Record<PresenceStatus, string> = {
  online: "border-background ring-1 ring-green-500/40",
  idle: "border-background ring-1 ring-yellow-400/40",
  offline: "border-background",
};

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: "Online",
  idle: "Idle",
  offline: "Offline",
};

export function PresenceDot({ status, className, size = "sm" }: PresenceDotProps) {
  const sizeClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  return (
    <span
      className={cn(
        "rounded-full border-2 flex-shrink-0",
        sizeClass,
        STATUS_COLORS[status],
        STATUS_RING[status],
        className
      )}
      title={STATUS_LABELS[status]}
    />
  );
}
