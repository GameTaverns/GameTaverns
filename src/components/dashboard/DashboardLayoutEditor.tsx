import { useState, useCallback, useMemo, useRef } from "react";
import {
  Pencil, X, RotateCcw, EyeOff, GripVertical,
  BookOpen, Mail, Users, Trophy, Star, Vote, Calendar,
  Target, Upload, Gamepad2, Plus, MessageSquare, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface WidgetConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  defaultVisible: boolean;
}

export const WIDGET_REGISTRY: WidgetConfig[] = [
  { id: "import-progress", label: "Import Progress", icon: Upload, defaultVisible: true },
  { id: "onboarding", label: "Getting Started", icon: Activity, defaultVisible: true },
  { id: "lending", label: "Game Lending", icon: BookOpen, defaultVisible: true },
  { id: "messages", label: "Messages", icon: Mail, defaultVisible: true },
  { id: "borrowed", label: "My Borrowed Games", icon: BookOpen, defaultVisible: true },
  { id: "communities", label: "My Communities", icon: Users, defaultVisible: true },
  { id: "achievements", label: "Achievements", icon: Trophy, defaultVisible: true },
  { id: "shelf-of-shame", label: "Shelf of Shame", icon: Gamepad2, defaultVisible: true },
  { id: "events", label: "Events", icon: Calendar, defaultVisible: true },
  { id: "polls", label: "Game Polls", icon: Vote, defaultVisible: true },
  { id: "inquiries", label: "My Inquiries", icon: MessageSquare, defaultVisible: true },
  { id: "explore", label: "Explore Checklist", icon: Star, defaultVisible: true },
  { id: "ratings-wishlist", label: "Ratings & Wishlist", icon: Star, defaultVisible: true },
  { id: "challenges", label: "Group Challenges", icon: Target, defaultVisible: true },
  { id: "random-picker", label: "Random Game Picker", icon: Target, defaultVisible: true },
  { id: "create-library", label: "Create Another Library", icon: Plus, defaultVisible: true },
];

const STORAGE_KEY = "dashboard-order-v1";
const VISIBILITY_KEY = "dashboard-visibility-v1";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return WIDGET_REGISTRY.map(w => w.id);
}

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

interface DashboardLayoutEditorProps {
  widgets: Record<string, React.ReactNode>;
  tab: string;
}

export function DashboardLayoutEditor({ widgets, tab }: DashboardLayoutEditorProps) {
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [hidden, setHidden] = useState<string[]>(loadHidden);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  // Ensure all registered widgets are in the order list
  const fullOrder = useMemo(() => {
    const existing = new Set(order);
    const missing = WIDGET_REGISTRY.map(w => w.id).filter(id => !existing.has(id));
    return [...order, ...missing];
  }, [order]);

  const visibleOrder = useMemo(
    () => fullOrder.filter(id => !hidden.includes(id)),
    [fullOrder, hidden]
  );

  const hiddenWidgets = useMemo(
    () => WIDGET_REGISTRY.filter(w => hidden.includes(w.id)),
    [hidden]
  );

  const saveOrder = useCallback((newOrder: string[]) => {
    setOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setHidden(prev => {
      const next = prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id];
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    const defaultOrder = WIDGET_REGISTRY.map(w => w.id);
    saveOrder(defaultOrder);
    setHidden([]);
    localStorage.removeItem(VISIBILITY_KEY);
  }, [saveOrder]);

  const handleDragStart = useCallback((id: string) => {
    dragItem.current = id;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragOverItem.current = id;
  }, []);

  const handleDrop = useCallback(() => {
    if (!dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) return;
    const newOrder = [...fullOrder];
    const fromIdx = newOrder.indexOf(dragItem.current);
    const toIdx = newOrder.indexOf(dragOverItem.current);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragItem.current);
    saveOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  }, [fullOrder, saveOrder]);

  if (tab !== "overview") {
    return <>{Object.values(widgets)}</>;
  }

  // Normal mode: render in saved order, skip nullish/hidden
  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> Customize Layout
          </Button>
        </div>
        {visibleOrder.map(id => {
          const content = widgets[id];
          if (!content) return null;
          return <div key={id}>{content}</div>;
        })}
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
          <span className="text-sm font-medium text-cream">Layout Editor</span>
          <Badge className="bg-secondary/30 text-cream text-xs">Drag to reorder · Toggle visibility</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={resetLayout} className="text-cream/70 hover:text-cream gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => setEditing(false)} className="bg-secondary text-secondary-foreground gap-1">
            <X className="h-3.5 w-3.5" /> Done
          </Button>
        </div>
      </div>

      {/* Hidden widgets */}
      {hiddenWidgets.length > 0 && (
        <div className="p-3 rounded-xl bg-wood-medium/20 border border-wood-medium/40">
          <p className="text-xs text-cream/60 mb-2">Hidden widgets (click to show):</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map(w => (
              <Button
                key={w.id}
                size="sm"
                variant="outline"
                onClick={() => toggleWidget(w.id)}
                className="border-wood-medium/50 text-cream/70 hover:text-cream gap-1.5 text-xs"
              >
                <EyeOff className="h-3 w-3" />
                {w.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Draggable widget list */}
      <div className="space-y-2">
        {visibleOrder.map(id => {
          const config = WIDGET_REGISTRY.find(w => w.id === id);
          if (!config) return null;
          const content = widgets[id];
          const Icon = config.icon;

          return (
            <div
              key={id}
              draggable
              onDragStart={() => handleDragStart(id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDrop={handleDrop}
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
                  <span className="text-xs font-medium text-cream/80">{config.label}</span>
                  {!content && <Badge variant="outline" className="text-[10px] text-cream/40">empty</Badge>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); toggleWidget(id); }}
                  className="h-6 w-6 p-0 text-cream/50 hover:text-destructive"
                >
                  <EyeOff className="h-3 w-3" />
                </Button>
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
