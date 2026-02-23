import { useState, useRef, useCallback } from "react";
import {
  Settings, X, RotateCcw, GripVertical, Eye, EyeOff,
  ChevronUp, ChevronDown, Library, Users, Globe, User,
  BarChart3, AlertTriangle, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardTabDef } from "@/hooks/useUserDashboardPrefs";

const ICON_MAP: Record<string, React.ElementType> = {
  Library, Users, Globe, User, BarChart3, AlertTriangle, Shield,
};

function getIcon(name: string) {
  return ICON_MAP[name] || Settings;
}

interface DashboardCustomizerProps {
  visibleTabs: DashboardTabDef[];
  hiddenTabDefs: DashboardTabDef[];
  toggleTab: (id: string) => void;
  moveTab: (id: string, direction: -1 | 1) => void;
  resetPrefs: () => void;
}

export function DashboardCustomizer({
  visibleTabs,
  hiddenTabDefs,
  toggleTab,
  moveTab,
  resetPrefs,
}: DashboardCustomizerProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-cream/50 hover:text-cream hover:bg-wood-medium/40 gap-1.5 h-7"
        title="Customize dashboard"
      >
        <Settings className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs">Customize</span>
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-secondary/40 bg-secondary/5 backdrop-blur-sm p-4 mb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-secondary" />
          <span className="text-sm font-semibold text-cream">Customize Dashboard</span>
          <Badge className="bg-secondary/20 text-cream/70 text-[10px]">
            Drag or use arrows to reorder
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={resetPrefs}
            className="text-cream/60 hover:text-cream gap-1 h-7 text-xs"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
          <Button
            size="sm"
            onClick={() => setOpen(false)}
            className="bg-secondary text-secondary-foreground gap-1 h-7 text-xs"
          >
            <X className="h-3 w-3" /> Done
          </Button>
        </div>
      </div>

      {/* Visible tabs */}
      <div className="space-y-1.5">
        <p className="text-xs text-cream/50 font-medium">Visible Tabs</p>
        {visibleTabs.map((tab, idx) => {
          const Icon = getIcon(tab.icon);
          return (
            <div
              key={tab.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-wood-medium/20 border border-wood-medium/40 group"
            >
              <GripVertical className="h-3.5 w-3.5 text-cream/30" />
              <Icon className="h-3.5 w-3.5 text-secondary" />
              <span className="text-xs font-medium text-cream flex-1">{tab.label}</span>
              <div className="flex items-center gap-0.5">
                {idx > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveTab(tab.id, -1)}
                    className="h-6 w-6 p-0 text-cream/40 hover:text-cream"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                )}
                {idx < visibleTabs.length - 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveTab(tab.id, 1)}
                    className="h-6 w-6 p-0 text-cream/40 hover:text-cream"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleTab(tab.id)}
                  className="h-6 w-6 p-0 text-cream/40 hover:text-destructive"
                  title="Hide tab"
                >
                  <EyeOff className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden tabs */}
      {hiddenTabDefs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-cream/50 font-medium">Hidden Tabs (click to restore)</p>
          <div className="flex flex-wrap gap-2">
            {hiddenTabDefs.map(tab => {
              const Icon = getIcon(tab.icon);
              return (
                <Button
                  key={tab.id}
                  size="sm"
                  variant="outline"
                  onClick={() => toggleTab(tab.id)}
                  className="border-wood-medium/50 text-cream/60 hover:text-cream gap-1.5 text-xs h-7"
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                  <Eye className="h-3 w-3 ml-1 text-secondary" />
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
