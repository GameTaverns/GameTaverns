import { useMyLists } from "@/hooks/useCuratedLists";
import { List, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickerMyListsTabProps {
  selectedListId: string | null;
  onSelectList: (id: string | null) => void;
}

export function PickerMyListsTab({ selectedListId, onSelectList }: PickerMyListsTabProps) {
  const { data: lists = [], isLoading } = useMyLists();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading lists...</p>;
  }

  if (lists.length === 0) {
    return (
      <div className="text-center py-6 space-y-1">
        <List className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No curated lists yet</p>
        <p className="text-xs text-muted-foreground/70">Create a list in your library to use it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">Pick a list to randomize from</p>
      {lists.map(list => (
        <div
          key={list.id}
          onClick={() => onSelectList(selectedListId === list.id ? null : list.id)}
          className={cn(
            "flex items-center gap-2 p-2.5 rounded-md cursor-pointer transition-colors",
            selectedListId === list.id
              ? "bg-primary/10 border border-primary/30"
              : "hover:bg-muted/50 border border-transparent"
          )}
        >
          <List className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{list.title}</p>
            {list.items && (
              <p className="text-xs text-muted-foreground">{list.items.length} game{list.items.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          {selectedListId === list.id && <Check className="h-4 w-4 text-primary shrink-0" />}
        </div>
      ))}
    </div>
  );
}
