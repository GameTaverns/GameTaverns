import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2 } from "lucide-react";

interface Library {
  id: string;
  name: string;
  slug: string;
}

interface LibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraries: Library[];
  onSelect: (libraryId: string) => void;
  isPending?: boolean;
  gameTitle?: string;
}

export function LibraryPickerDialog({
  open,
  onOpenChange,
  libraries,
  onSelect,
  isPending,
  gameTitle,
}: LibraryPickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelect(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Add to Library</DialogTitle>
          <DialogDescription>
            {gameTitle
              ? `Choose which library to add "${gameTitle}" to.`
              : "Choose which library to add this game to."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {libraries.map((lib) => (
            <Button
              key={lib.id}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              disabled={isPending && selectedId === lib.id}
              onClick={() => handleSelect(lib.id)}
            >
              {isPending && selectedId === lib.id ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <BookOpen className="h-4 w-4 shrink-0 text-primary" />
              )}
              <span className="truncate">{lib.name}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
