import { cn } from "@/lib/utils";

interface PickerChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function PickerChip({ label, selected, onClick }: PickerChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        selected
          ? "bg-primary/20 border-primary/50 text-primary"
          : "bg-transparent border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
