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
  offline: "bg-slate-400",
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
        "rounded-full border-2 border-background flex-shrink-0",
        sizeClass,
        STATUS_COLORS[status],
        className
      )}
      title={STATUS_LABELS[status]}
    />
  );
}
