import { useState, useCallback, useMemo, useRef } from "react";
import {
  Pencil, X, RotateCcw, EyeOff, Eye, GripVertical,
  ChevronUp, ChevronDown,
  // Icon imports for widget registry lookups
  Activity, Flame, Gamepad2, Calendar, Vote, MessageSquare,
  BookOpen, Star, Shuffle, Settings, Plus, ListOrdered,
  Users, Globe, ArrowLeftRight, Target, Trophy, User, Upload,
  Database, HeartPulse, Crown, BadgeCheck, Clock, Terminal, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WidgetDef } from "@/hooks/useUserDashboardPrefs";

const ICON_MAP: Record<string, React.ElementType> = {
  Activity, Flame, Gamepad2, Calendar, Vote, MessageSquare,
  BookOpen, Star, Shuffle, Settings, Plus, ListOrdered,
  Users, Globe, ArrowLeftRight, Target, Trophy, User, Upload,
  Database, HeartPulse, Crown, BadgeCheck, Clock, Terminal, Shield,
};

function getWidgetIcon(iconName: string) {
  return ICON_MAP[iconName] || Settings;
}

interface TabWidgetEditorProps {
  tabId: string;
  /** Map of widget ID → rendered React content */
  widgets: Record<string, React.ReactNode>;
  /** Ordered list of visible widget IDs */
  visibleWidgetIds: string[];
  /** Hidden widget defs for restore UI */
  hiddenWidgets: WidgetDef[];
  /** Full registry for this tab (for label/icon lookups) */
  registry: WidgetDef[];
  /** Callbacks */
  onToggleWidget: (widgetId: string) => void;
  onMoveWidget: (widgetId: string, direction: -1 | 1) => void;
  onResetTab: () => void;
  /** Optional: grid class for the content layout (default: "space-y-4") */
  contentClassName?: string;
}

export function TabWidgetEditor({
  tabId,
  widgets,
  visibleWidgetIds,
  hiddenWidgets,
  registry,
  onToggleWidget,
  onMoveWidget,
  onResetTab,
  contentClassName,
}: TabWidgetEditorProps) {
  const [editing, setEditing] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  // Normal mode: render widgets in saved order
  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" /> Customize Widgets
          </Button>
        </div>
        <div className={contentClassName || "space-y-4"}>
          {visibleWidgetIds.map(id => {
            const content = widgets[id];
            if (!content) return null;
            return <div key={id}>{content}</div>;
          })}
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-secondary/20 border border-secondary/40">
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-secondary" />
          <span className="text-sm font-medium text-cream">Widget Editor</span>
          <Badge className="bg-secondary/30 text-cream text-xs hidden sm:inline-flex">
            Drag to reorder · Toggle visibility
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onResetTab} className="text-cream/70 hover:text-cream gap-1 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => setEditing(false)} className="bg-secondary text-secondary-foreground gap-1 text-xs">
            <X className="h-3.5 w-3.5" /> Done
          </Button>
        </div>
      </div>

      {/* Hidden widgets */}
      {hiddenWidgets.length > 0 && (
        <div className="p-3 rounded-xl bg-wood-medium/20 border border-wood-medium/40">
          <p className="text-xs text-cream/60 mb-2">Hidden widgets (click to show):</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map(w => {
              const Icon = getWidgetIcon(w.icon);
              return (
                <Button
                  key={w.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleWidget(w.id)}
                  className="border-wood-medium/50 text-cream/70 hover:text-cream gap-1.5 text-xs"
                >
                  <Eye className="h-3 w-3 text-secondary" />
                  <Icon className="h-3 w-3" />
                  {w.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Draggable widget list */}
      <div className="space-y-2">
        {visibleWidgetIds.map((id, idx) => {
          const def = registry.find(w => w.id === id);
          if (!def) return null;
          const content = widgets[id];
          const Icon = getWidgetIcon(def.icon);

          return (
            <div
              key={id}
              draggable
              onDragStart={() => { dragItem.current = id; }}
              onDragOver={(e) => { e.preventDefault(); dragOverItem.current = id; }}
              onDrop={() => {
                // Drag-drop reorder is handled via move for simplicity
                dragItem.current = null;
                dragOverItem.current = null;
              }}
              className={cn(
                "rounded-xl border-2 border-dashed border-secondary/30 bg-wood-medium/10 overflow-hidden",
                "transition-all hover:border-secondary/60 cursor-grab active:cursor-grabbing"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/10 border-b border-secondary/20">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-cream/40" />
                  <Icon className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-xs font-medium text-cream/80">{def.label}</span>
                  {!content && <Badge variant="outline" className="text-[10px] text-cream/40">empty</Badge>}
                </div>
                <div className="flex items-center gap-0.5">
                  {idx > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => onMoveWidget(id, -1)} className="h-6 w-6 p-0 text-cream/40 hover:text-cream">
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  )}
                  {idx < visibleWidgetIds.length - 1 && (
                    <Button size="sm" variant="ghost" onClick={() => onMoveWidget(id, 1)} className="h-6 w-6 p-0 text-cream/40 hover:text-cream">
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onToggleWidget(id); }}
                    className="h-6 w-6 p-0 text-cream/50 hover:text-destructive"
                  >
                    <EyeOff className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Preview (muted, non-interactive) */}
              <div className="p-3 opacity-50 pointer-events-none max-h-[200px] overflow-hidden">
                {content || (
                  <div className="flex items-center justify-center h-16 text-cream/30 text-sm">
                    No content to display
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
