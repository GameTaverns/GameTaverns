import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoPopoverProps {
  title: string;
  description: string;
  /** Optional extra tips displayed as a bullet list */
  tips?: string[];
  className?: string;
  /** Icon size – defaults to 4 */
  iconSize?: number;
}

/**
 * A small "?" icon that opens a contextual help popover.
 * Use next to section headings or form labels.
 */
export function InfoPopover({
  title,
  description,
  tips,
  className,
  iconSize = 4,
}: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={`Help: ${title}`}
        >
          <HelpCircle className={`h-${iconSize} w-${iconSize}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-w-xs text-sm space-y-2"
      >
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
        {tips && tips.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            {tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
