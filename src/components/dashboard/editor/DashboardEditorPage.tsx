import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, RotateCcw, Plus, Trash2, GripVertical,
  Pencil, Check, X, Eye, EyeOff, ChevronUp, ChevronDown,
  Activity, Zap, MessageSquare, Users, Settings, Star,
  Trophy, BookOpen, Calendar, BarChart3, Target, Heart,
  Shield, Globe, Mail, Gamepad2, Vote, Upload,
  ArrowLeftRight, AlertTriangle, DollarSign, Palette, Plus as PlusIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDashboardLayout, useSaveDashboardLayout } from "@/hooks/useDashboardLayout";
import { WIDGET_REGISTRY, WIDGET_MAP, DEFAULT_LAYOUT, TAB_ICON_OPTIONS } from "./widgetRegistry";
import type { DashboardLayoutConfig, TabConfig } from "./types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// Icon lookup
const ICON_MAP: Record<string, React.ElementType> = {
  Activity, Zap, MessageSquare, Users, Settings, Star, Trophy, BookOpen,
  Calendar, BarChart3, Target, Heart, Shield, Globe, Mail, Gamepad2,
  Vote, Upload, ArrowLeftRight, AlertTriangle, Plus: PlusIcon, DollarSign, Palette,
};

function getIcon(name: string) {
  return ICON_MAP[name] || Activity;
}

export default function DashboardEditorPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { data: savedLayout, isLoading } = useDashboardLayout();
  const saveMutation = useSaveDashboardLayout();
  const { toast } = useToast();

  const [config, setConfig] = useState<DashboardLayoutConfig | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>("overview");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabLabel, setEditingTabLabel] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Drag state
  const dragWidget = useRef<{ widgetId: string; fromTabId: string | null } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ tabId: string; index: number } | null>(null);

  // Initialize from saved layout
  useEffect(() => {
    if (savedLayout && !config) {
      setConfig(JSON.parse(JSON.stringify(savedLayout)));
    }
  }, [savedLayout, config]);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [authLoading, isAdmin, navigate]);

  const activeTab = useMemo(
    () => config?.tabs.find(t => t.id === activeTabId) ?? config?.tabs[0] ?? null,
    [config, activeTabId]
  );

  // All placed widget IDs
  const placedWidgetIds = useMemo(() => {
    if (!config) return new Set<string>();
    return new Set(config.tabs.flatMap(t => t.widgets));
  }, [config]);

  // Unplaced widgets
  const unplacedWidgets = useMemo(
    () => WIDGET_REGISTRY.filter(w => !placedWidgetIds.has(w.id)),
    [placedWidgetIds]
  );

  const updateConfig = useCallback((updater: (prev: DashboardLayoutConfig) => DashboardLayoutConfig) => {
    setConfig(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      setHasChanges(true);
      return next;
    });
  }, []);

  // --- Tab management ---
  const addTab = useCallback(() => {
    const id = `tab-${Date.now()}`;
    updateConfig(cfg => ({
      ...cfg,
      tabs: [...cfg.tabs, { id, label: "New Tab", icon: "Star", widgets: [] }],
    }));
    setActiveTabId(id);
    setEditingTabId(id);
    setEditingTabLabel("New Tab");
  }, [updateConfig]);

  const removeTab = useCallback((tabId: string) => {
    updateConfig(cfg => ({
      ...cfg,
      tabs: cfg.tabs.filter(t => t.id !== tabId),
    }));
    if (activeTabId === tabId) {
      setActiveTabId(config?.tabs[0]?.id ?? "");
    }
  }, [updateConfig, activeTabId, config]);

  const renameTab = useCallback((tabId: string, label: string) => {
    updateConfig(cfg => ({
      ...cfg,
      tabs: cfg.tabs.map(t => t.id === tabId ? { ...t, label } : t),
    }));
    setEditingTabId(null);
  }, [updateConfig]);

  const changeTabIcon = useCallback((tabId: string, icon: string) => {
    updateConfig(cfg => ({
      ...cfg,
      tabs: cfg.tabs.map(t => t.id === tabId ? { ...t, icon } : t),
    }));
  }, [updateConfig]);

  const moveTab = useCallback((tabId: string, direction: -1 | 1) => {
    updateConfig(cfg => {
      const idx = cfg.tabs.findIndex(t => t.id === tabId);
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= cfg.tabs.length) return cfg;
      const tabs = [...cfg.tabs];
      [tabs[idx], tabs[newIdx]] = [tabs[newIdx], tabs[idx]];
      return { ...cfg, tabs };
    });
  }, [updateConfig]);

  // --- Widget management ---
  const removeWidget = useCallback((tabId: string, widgetId: string) => {
    updateConfig(cfg => ({
      ...cfg,
      tabs: cfg.tabs.map(t =>
        t.id === tabId ? { ...t, widgets: t.widgets.filter(w => w !== widgetId) } : t
      ),
    }));
  }, [updateConfig]);

  const addWidgetToTab = useCallback((tabId: string, widgetId: string) => {
    updateConfig(cfg => ({
      ...cfg,
      tabs: cfg.tabs.map(t =>
        t.id === tabId ? { ...t, widgets: [...t.widgets, widgetId] } : t
      ),
    }));
  }, [updateConfig]);

  const moveWidgetInTab = useCallback((tabId: string, fromIdx: number, toIdx: number) => {
    updateConfig(cfg => ({
      ...cfg,
      tabs: cfg.tabs.map(t => {
        if (t.id !== tabId) return t;
        const widgets = [...t.widgets];
        const [item] = widgets.splice(fromIdx, 1);
        widgets.splice(toIdx, 0, item);
        return { ...t, widgets };
      }),
    }));
  }, [updateConfig]);

  // --- Drag handlers ---
  const handleDragStart = useCallback((widgetId: string, fromTabId: string | null) => {
    dragWidget.current = { widgetId, fromTabId };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ tabId, index });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string, targetIndex: number) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!dragWidget.current) return;

    const { widgetId, fromTabId } = dragWidget.current;
    dragWidget.current = null;

    updateConfig(cfg => {
      const tabs = cfg.tabs.map(t => {
        if (t.id === fromTabId) {
          return { ...t, widgets: t.widgets.filter(w => w !== widgetId) };
        }
        return t;
      });

      return {
        ...cfg,
        tabs: tabs.map(t => {
          if (t.id !== targetTabId) return t;
          const widgets = [...t.widgets];
          // If moving within same tab, adjust index
          if (fromTabId === targetTabId) {
            const oldIdx = t.widgets.indexOf(widgetId);
            const filtered = t.widgets.filter(w => w !== widgetId);
            const adjustedIdx = targetIndex > oldIdx ? targetIndex - 1 : targetIndex;
            filtered.splice(adjustedIdx, 0, widgetId);
            return { ...t, widgets: filtered };
          }
          widgets.splice(targetIndex, 0, widgetId);
          return { ...t, widgets };
        }),
      };
    });
  }, [updateConfig]);

  // --- Save / Reset ---
  const handleSave = useCallback(async () => {
    if (!config) return;
    try {
      await saveMutation.mutateAsync(config);
      setHasChanges(false);
      toast({ title: "Layout saved", description: "All users will now see this layout." });
    } catch (err) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
    }
  }, [config, saveMutation, toast]);

  const handleReset = useCallback(() => {
    setConfig(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    setHasChanges(true);
    setActiveTabId("overview");
  }, []);

  if (authLoading || isLoading || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex flex-col">
      {/* Top bar */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-cream hover:text-white gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6 bg-wood-medium/50" />
          <h1 className="font-display text-lg font-bold text-cream">Dashboard Layout Editor</h1>
          {hasChanges && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40">Unsaved changes</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-cream/70 hover:text-cream gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="bg-secondary text-secondary-foreground gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Layout"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Tab list + Unplaced widgets */}
        <aside className="w-72 border-r border-wood-medium/50 bg-wood-dark/60 flex flex-col">
          {/* Tabs section */}
          <div className="p-4 border-b border-wood-medium/40">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-cream">Tabs</h2>
              <Button size="sm" variant="ghost" onClick={addTab} className="h-7 text-cream/70 hover:text-cream gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="space-y-1">
              {config.tabs.map((tab, idx) => {
                const TabIcon = getIcon(tab.icon);
                const isActive = activeTabId === tab.id;
                const isEditing = editingTabId === tab.id;

                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group",
                      isActive ? "bg-secondary/20 text-cream" : "text-cream/60 hover:bg-wood-medium/30 hover:text-cream"
                    )}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <TabIcon className="h-4 w-4 flex-shrink-0" />
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editingTabLabel}
                          onChange={e => setEditingTabLabel(e.target.value)}
                          className="h-6 text-xs bg-wood-medium/40 border-wood-medium/60 text-cream px-1.5"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") renameTab(tab.id, editingTabLabel);
                            if (e.key === "Escape") setEditingTabId(null);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => renameTab(tab.id, editingTabLabel)}
                          className="h-6 w-6 p-0 text-green-400"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-medium flex-1 truncate">{tab.label}</span>
                        <span className="text-[10px] text-cream/40">{tab.widgets.length}</span>
                        <div className="hidden group-hover:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingTabId(tab.id); setEditingTabLabel(tab.label); }}
                            className="h-5 w-5 p-0 text-cream/40 hover:text-cream"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                          {idx > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveTab(tab.id, -1)}
                              className="h-5 w-5 p-0 text-cream/40 hover:text-cream"
                            >
                              <ChevronUp className="h-2.5 w-2.5" />
                            </Button>
                          )}
                          {idx < config.tabs.length - 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveTab(tab.id, 1)}
                              className="h-5 w-5 p-0 text-cream/40 hover:text-cream"
                            >
                              <ChevronDown className="h-2.5 w-2.5" />
                            </Button>
                          )}
                          {config.tabs.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeTab(tab.id)}
                              className="h-5 w-5 p-0 text-cream/40 hover:text-red-400"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tab settings */}
          {activeTab && (
            <div className="p-4 border-b border-wood-medium/40">
              <h3 className="text-xs font-semibold text-cream/60 mb-2">Tab Settings</h3>
              <label className="text-xs text-cream/50 mb-1 block">Icon</label>
              <Select
                value={activeTab.icon}
                onValueChange={(v) => changeTabIcon(activeTab.id, v)}
              >
                <SelectTrigger className="h-8 text-xs bg-wood-medium/40 border-wood-medium/60 text-cream">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-wood-dark border-wood-medium/60">
                  {TAB_ICON_OPTIONS.map(iconName => {
                    const Icon = getIcon(iconName);
                    return (
                      <SelectItem key={iconName} value={iconName} className="text-cream text-xs">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {iconName}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Unplaced widgets */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold text-cream">
                Available Widgets
                {unplacedWidgets.length > 0 && (
                  <Badge className="ml-2 bg-secondary/20 text-cream text-[10px]">{unplacedWidgets.length}</Badge>
                )}
              </h2>
              <p className="text-[10px] text-cream/40 mt-1">Drag to a tab or click + to add</p>
            </div>
            <ScrollArea className="flex-1 px-4 pb-4">
              <div className="space-y-1">
                {unplacedWidgets.length === 0 ? (
                  <p className="text-xs text-cream/40 py-4 text-center">All widgets placed</p>
                ) : (
                  unplacedWidgets.map(widget => {
                    const WidgetIcon = getIcon(widget.icon);
                    return (
                      <div
                        key={widget.id}
                        draggable
                        onDragStart={() => handleDragStart(widget.id, null)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-wood-medium/20 border border-dashed border-wood-medium/40 cursor-grab active:cursor-grabbing hover:bg-wood-medium/30 transition-colors group"
                      >
                        <GripVertical className="h-3 w-3 text-cream/30" />
                        <WidgetIcon className="h-3.5 w-3.5 text-secondary/60" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-cream/70 truncate">{widget.label}</p>
                        </div>
                        {widget.adminOnly && <Badge className="text-[8px] bg-amber-500/20 text-amber-400">Admin</Badge>}
                        {activeTab && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addWidgetToTab(activeTab.id, widget.id)}
                            className="h-5 w-5 p-0 text-cream/40 hover:text-secondary opacity-0 group-hover:opacity-100"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </aside>

        {/* Main area: active tab's widgets */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                {(() => { const I = getIcon(activeTab.icon); return <I className="h-6 w-6 text-secondary" />; })()}
                <h2 className="font-display text-xl font-bold text-cream">{activeTab.label}</h2>
                <Badge variant="outline" className="text-cream/50 text-xs">{activeTab.widgets.length} widgets</Badge>
              </div>

              {/* Widget slots */}
              <div className="space-y-2">
                {activeTab.widgets.map((widgetId, idx) => {
                  const widget = WIDGET_MAP.get(widgetId);
                  if (!widget) return null;
                  const WidgetIcon = getIcon(widget.icon);
                  const isDropTarget = dragOverTarget?.tabId === activeTab.id && dragOverTarget?.index === idx;

                  return (
                    <div key={widgetId}>
                      {/* Drop zone before */}
                      <div
                        className={cn(
                          "h-1 rounded-full mx-4 transition-all",
                          isDropTarget ? "bg-secondary h-2" : "bg-transparent"
                        )}
                        onDragOver={e => handleDragOver(e, activeTab.id, idx)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, activeTab.id, idx)}
                      />
                      <div
                        draggable
                        onDragStart={() => handleDragStart(widgetId, activeTab.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl border border-wood-medium/40 bg-wood-medium/20",
                          "cursor-grab active:cursor-grabbing hover:border-secondary/40 transition-all group"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-cream/30" />
                        <WidgetIcon className="h-4 w-4 text-secondary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-cream">{widget.label}</p>
                          {widget.description && (
                            <p className="text-xs text-cream/50 truncate">{widget.description}</p>
                          )}
                        </div>
                        {widget.adminOnly && <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/40">Admin Only</Badge>}
                        <div className="flex items-center gap-1">
                          {idx > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveWidgetInTab(activeTab.id, idx, idx - 1)}
                              className="h-7 w-7 p-0 text-cream/40 hover:text-cream opacity-0 group-hover:opacity-100"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {idx < activeTab.widgets.length - 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => moveWidgetInTab(activeTab.id, idx, idx + 1)}
                              className="h-7 w-7 p-0 text-cream/40 hover:text-cream opacity-0 group-hover:opacity-100"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeWidget(activeTab.id, widgetId)}
                            className="h-7 w-7 p-0 text-cream/40 hover:text-red-400 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Final drop zone */}
                <div
                  className={cn(
                    "h-12 rounded-xl border-2 border-dashed transition-all flex items-center justify-center",
                    dragOverTarget?.tabId === activeTab.id && dragOverTarget?.index === activeTab.widgets.length
                      ? "border-secondary bg-secondary/10"
                      : "border-wood-medium/30 bg-transparent"
                  )}
                  onDragOver={e => handleDragOver(e, activeTab.id, activeTab.widgets.length)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, activeTab.id, activeTab.widgets.length)}
                >
                  <p className="text-xs text-cream/30">Drop widget here</p>
                </div>

                {activeTab.widgets.length === 0 && (
                  <div className="text-center py-12">
                    <Gamepad2 className="h-12 w-12 mx-auto text-cream/20 mb-4" />
                    <p className="text-cream/40 text-sm">No widgets in this tab yet.</p>
                    <p className="text-cream/30 text-xs mt-1">Drag from the sidebar or click + to add widgets.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-cream/40">
              Select a tab to edit
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
