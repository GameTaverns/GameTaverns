import { lazy, Suspense, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Shield, Activity, Users, Database, Settings, MessageSquare,
  Trophy, HeartPulse, Crown, BadgeCheck, Clock, Terminal, Globe,
  Pencil, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, X,
} from "lucide-react";
import { useState } from "react";

import { UserManagement } from "@/components/admin/UserManagement";
import { LibraryManagement } from "@/components/admin/LibraryManagement";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { PlatformAnalytics } from "@/components/admin/PlatformAnalytics";
import { FeedbackManagement } from "@/components/admin/FeedbackManagement";
import { ClubsManagement } from "@/components/admin/ClubsManagement";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { PlatformRoadmap } from "@/components/admin/PlatformRoadmap";
import { TAB_WIDGET_REGISTRY, type WidgetDef } from "@/hooks/useUserDashboardPrefs";

const SpecialBadgesManagement = lazy(() =>
  import("@/components/admin/SpecialBadgesManagement").then(m => ({ default: m.SpecialBadgesManagement }))
);
const ServerManagement = lazy(() =>
  import("@/components/admin/ServerManagement").then(m => ({ default: m.ServerManagement }))
);
const CronJobsMonitor = lazy(() =>
  import("@/components/admin/CronJobsMonitor").then(m => ({ default: m.CronJobsMonitor }))
);
const AuditLogViewer = lazy(() =>
  import("@/components/admin/AuditLogViewer").then(m => ({ default: m.AuditLogViewer }))
);
const SeoDirectory = lazy(() =>
  import("@/components/admin/SeoDirectory").then(m => ({ default: m.SeoDirectory }))
);

const ICON_MAP: Record<string, React.ElementType> = {
  Activity, Users, Database, Settings, MessageSquare,
  Trophy, HeartPulse, Crown, BadgeCheck, Clock, Terminal, Shield, Globe,
};

const SUBTAB_CONTENT: Record<string, React.ReactNode> = {};

interface AdminSubtabPanelProps {
  dashPrefs: {
    getVisibleWidgets: (tabId: string) => string[];
    getHiddenWidgets: (tabId: string) => WidgetDef[];
    toggleWidget: (tabId: string, widgetId: string) => void;
    moveWidget: (tabId: string, widgetId: string, direction: -1 | 1) => void;
    resetTabWidgets: (tabId: string) => void;
  };
  unreadFeedbackCount?: number | null;
  pendingClubs?: any[] | null;
}

export function AdminSubtabPanel({ dashPrefs, unreadFeedbackCount, pendingClubs }: AdminSubtabPanelProps) {
  const [editing, setEditing] = useState(false);
  const visibleIds = dashPrefs.getVisibleWidgets("admin");
  const hiddenWidgets = dashPrefs.getHiddenWidgets("admin");
  const registry = TAB_WIDGET_REGISTRY["admin"] ?? [];

  const [activeSubtab, setActiveSubtab] = useState(visibleIds[0] || "analytics");

  // If active subtab got hidden, switch to first visible
  const effectiveTab = visibleIds.includes(activeSubtab) ? activeSubtab : visibleIds[0] || "analytics";

  const subtabContent: Record<string, React.ReactNode> = {
    analytics: <PlatformAnalytics />,
    users: <UserManagement />,
    libraries: <LibraryManagement />,
    settings: <PlatformSettings />,
    feedback: <FeedbackManagement />,
    clubs: <ClubsManagement />,
    health: <SystemHealth />,
    premium: <PlatformRoadmap />,
    badges: (
      <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading badges…</div>}>
        <SpecialBadgesManagement />
      </Suspense>
    ),
    crons: (
      <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading cron monitor…</div>}>
        <CronJobsMonitor />
      </Suspense>
    ),
    server: (
      <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading server tools…</div>}>
        <ServerManagement />
      </Suspense>
    ),
    security: (
      <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading security logs…</div>}>
        <AuditLogViewer />
      </Suspense>
    ),
    seo: (
      <Suspense fallback={<div className="text-cream/70 text-sm p-4">Loading SEO directory…</div>}>
        <SeoDirectory />
      </Suspense>
    ),
  };

  const badgeCounts: Record<string, number> = {};
  if (unreadFeedbackCount && unreadFeedbackCount > 0) badgeCounts["feedback"] = unreadFeedbackCount;
  if (pendingClubs && pendingClubs.length > 0) badgeCounts["clubs"] = pendingClubs.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-secondary" />
          <h2 className="font-display text-lg font-bold text-cream">Site Administration</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(!editing)}
          className="border-secondary/50 text-cream hover:bg-wood-medium/50 gap-1.5 text-xs"
        >
          {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editing ? "Done" : "Customize Subtabs"}
        </Button>
      </div>

      {/* Edit mode */}
      {editing && (
        <div className="space-y-3 p-3 rounded-xl bg-secondary/10 border border-secondary/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-cream">Subtab Editor</span>
            <Button size="sm" variant="ghost" onClick={() => dashPrefs.resetTabWidgets("admin")} className="text-cream/70 hover:text-cream gap-1 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>

          {/* Visible subtabs */}
          <div className="space-y-1">
            {visibleIds.map((id, idx) => {
              const def = registry.find(w => w.id === id);
              if (!def) return null;
              const Icon = ICON_MAP[def.icon] || Settings;
              return (
                <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-wood-medium/20 border border-wood-medium/30">
                  <Icon className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-xs font-medium text-cream flex-1">{def.label}</span>
                  {idx > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => dashPrefs.moveWidget("admin", id, -1)} className="h-6 w-6 p-0 text-cream/40 hover:text-cream">
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  )}
                  {idx < visibleIds.length - 1 && (
                    <Button size="sm" variant="ghost" onClick={() => dashPrefs.moveWidget("admin", id, 1)} className="h-6 w-6 p-0 text-cream/40 hover:text-cream">
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => dashPrefs.toggleWidget("admin", id)} className="h-6 w-6 p-0 text-cream/50 hover:text-destructive">
                    <EyeOff className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Hidden subtabs */}
          {hiddenWidgets.length > 0 && (
            <div className="pt-2 border-t border-wood-medium/30">
              <p className="text-xs text-cream/60 mb-2">Hidden subtabs (click to show):</p>
              <div className="flex flex-wrap gap-2">
                {hiddenWidgets.map(w => {
                  const Icon = ICON_MAP[w.icon] || Settings;
                  return (
                    <Button
                      key={w.id}
                      size="sm"
                      variant="outline"
                      onClick={() => dashPrefs.toggleWidget("admin", w.id)}
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
        </div>
      )}

      {/* Subtabs */}
      <Tabs value={effectiveTab} onValueChange={setActiveSubtab}>
        <TabsList className="bg-wood-medium/30 border border-wood-medium/50 h-auto flex-wrap gap-1 p-1 w-full overflow-x-auto">
          {visibleIds.map(id => {
            const def = registry.find(w => w.id === id);
            if (!def) return null;
            const Icon = ICON_MAP[def.icon] || Settings;
            const badgeCount = badgeCounts[id];
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground text-xs sm:text-sm relative"
              >
                <Icon className="h-4 w-4 mr-1 sm:mr-2" />
                {def.label}
                {badgeCount && badgeCount > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground">
                    {badgeCount}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {visibleIds.map(id => (
          <TabsContent key={id} value={id} className="mt-6">
            {subtabContent[id] || <div className="text-cream/50 text-sm">No content</div>}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
