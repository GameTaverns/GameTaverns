import { useMemo, useState } from "react";
import { Gamepad2, Dices, Trophy, BookOpen, MessageSquare, Users, Star, Filter } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import type { FeedItem } from "@/utils/groupActivityEvents";

const FILTER_OPTIONS = [
  { key: "game_added", label: "Games", icon: Gamepad2 },
  { key: "session_logged", label: "Sessions", icon: Dices },
  { key: "achievement_earned", label: "Achievements", icon: Trophy },
  { key: "expansion_added", label: "Expansions", icon: BookOpen },
  { key: "forum_post", label: "Forums", icon: MessageSquare },
  { key: "library_created", label: "Libraries", icon: Users },
  { key: "review_posted", label: "Reviews", icon: Star },
] as const;

export function useActivityFilters(items: FeedItem[]) {
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (hiddenTypes.size === 0) return items;
    return items.filter((item) => {
      if (item.type === "batch") {
        // Batches are always game_added/expansion_added
        return !hiddenTypes.has("game_added") || !hiddenTypes.has("expansion_added");
      }
      return !hiddenTypes.has(item.event.event_type);
    });
  }, [items, hiddenTypes]);

  const toggle = (key: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Only show filter options that exist in the data
  const availableFilters = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) {
      if (item.type === "batch") {
        types.add("game_added");
      } else {
        types.add(item.event.event_type);
      }
    }
    return FILTER_OPTIONS.filter((f) => types.has(f.key));
  }, [items]);

  return { filtered, hiddenTypes, toggle, availableFilters };
}

export function ActivityFilterBar({
  hiddenTypes,
  toggle,
  availableFilters,
}: {
  hiddenTypes: Set<string>;
  toggle: (key: string) => void;
  availableFilters: typeof FILTER_OPTIONS[number][];
}) {
  if (availableFilters.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {availableFilters.map(({ key, label, icon: Icon }) => {
        const active = !hiddenTypes.has(key);
        return (
          <Toggle
            key={key}
            size="sm"
            pressed={active}
            onPressedChange={() => toggle(key)}
            className="h-7 px-2.5 gap-1 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
          >
            <Icon className="h-3 w-3" />
            {label}
          </Toggle>
        );
      })}
    </div>
  );
}
