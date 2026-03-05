import { Button } from "@/components/ui/button";

interface LibrarySwitcherProps {
  libraries: Array<{ id: string; name: string }>;
  activeLibraryId: string | null;
  onSwitch: (id: string) => void;
}

/**
 * Inline button row for switching between libraries on dashboard spoke pages.
 * Only renders when there are 2+ libraries.
 */
export function LibrarySwitcher({ libraries, activeLibraryId, onSwitch }: LibrarySwitcherProps) {
  if (libraries.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="text-xs text-muted-foreground font-medium">Library:</span>
      {libraries.map((lib) => (
        <Button
          key={lib.id}
          size="sm"
          variant={lib.id === activeLibraryId ? "default" : "outline"}
          className="text-xs h-7"
          onClick={() => onSwitch(lib.id)}
        >
          {lib.name}
        </Button>
      ))}
    </div>
  );
}
