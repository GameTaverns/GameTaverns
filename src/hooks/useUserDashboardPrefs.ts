import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "user-dashboard-prefs-v1";

export interface UserDashboardPrefs {
  /** Ordered list of tab IDs (user's preferred order) */
  tabOrder: string[];
  /** Tab IDs the user has hidden */
  hiddenTabs: string[];
  /** Per-tab widget order overrides: tabId -> ordered widget IDs */
  widgetOrder: Record<string, string[]>;
  /** Per-tab hidden widgets: tabId -> hidden widget IDs */
  hiddenWidgets: Record<string, string[]>;
  /** Per-tab widget column spans: tabId -> { widgetId -> colSpan (1-3) } */
  widgetSizes: Record<string, Record<string, number>>;
}

const EMPTY_PREFS: UserDashboardPrefs = {
  tabOrder: [],
  hiddenTabs: [],
  widgetOrder: {},
  hiddenWidgets: {},
  widgetSizes: {},
};

function loadPrefs(): UserDashboardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...EMPTY_PREFS, ...parsed };
    }
  } catch {}
  return EMPTY_PREFS;
}

function savePrefsLocal(prefs: UserDashboardPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * All available dashboard tabs with their default config.
 */
export interface DashboardTabDef {
  id: string;
  label: string;
  icon: string;
  /** If true, only visible to admins/staff */
  adminOnly?: boolean;
}

export const DASHBOARD_TABS: DashboardTabDef[] = [
  { id: "library", label: "Library", icon: "Library" },
  { id: "community", label: "Community", icon: "Users" },
  { id: "social", label: "Social", icon: "Globe" },
  { id: "personal", label: "Personal", icon: "User" },
  { id: "referrals", label: "Referrals", icon: "Users" },
  { id: "analytics", label: "Analytics", icon: "BarChart3" },
  { id: "danger", label: "Danger", icon: "AlertTriangle" },
  { id: "admin", label: "Admin", icon: "Shield", adminOnly: true },
];

/** Widget definition for per-tab registries */
export interface WidgetDef {
  id: string;
  label: string;
  icon: string;
}

/** Registry of widgets per tab – source of truth for what widgets exist within each tab */
export const TAB_WIDGET_REGISTRY: Record<string, WidgetDef[]> = {
  library: [
    { id: "onboarding", label: "Getting Started", icon: "Activity" },
    { id: "trending", label: "Trending This Month", icon: "Flame" },
    { id: "games", label: "My Games", icon: "Gamepad2" },
    { id: "events", label: "Events", icon: "Calendar" },
    { id: "polls", label: "Polls", icon: "Vote" },
    { id: "community-link", label: "Community", icon: "MessageSquare" },
    { id: "lending", label: "Lending", icon: "BookOpen" },
    { id: "ratings-wishlist", label: "Ratings & Want to Play", icon: "Star" },
    { id: "shelf-of-shame", label: "Shelf of Shame", icon: "Gamepad2" },
    { id: "random-picker", label: "Random Picker", icon: "Shuffle" },
    { id: "settings", label: "Library Settings", icon: "Settings" },
    { id: "create-library", label: "Create Another Library", icon: "Plus" },
    { id: "curated-lists", label: "Curated Lists", icon: "ListOrdered" },
    { id: "growth-tools", label: "Share & Grow", icon: "Share2" },
    { id: "import-progress", label: "Import Progress", icon: "Upload" },
  ],
  community: [
    { id: "forums", label: "Forums", icon: "MessageSquare" },
    { id: "polls", label: "Polls", icon: "Vote" },
    { id: "clubs", label: "My Clubs", icon: "Users" },
    { id: "communities", label: "My Communities", icon: "Globe" },
    { id: "members", label: "Members", icon: "Users" },
    { id: "trades", label: "Trading", icon: "ArrowLeftRight" },
    { id: "challenges", label: "Challenges", icon: "Target" },
  ],
  personal: [
    { id: "profile", label: "My Profile", icon: "User" },
    { id: "account-settings", label: "Account Settings", icon: "Settings" },
    { id: "achievements", label: "Achievements", icon: "Trophy" },
    { id: "borrowed-games", label: "Borrowed Games", icon: "BookOpen" },
  ],
  admin: [
    { id: "analytics", label: "Analytics", icon: "Activity" },
    { id: "users", label: "Users", icon: "Users" },
    { id: "libraries", label: "Libraries", icon: "Database" },
    { id: "settings", label: "Settings", icon: "Settings" },
    { id: "feedback", label: "Feedback", icon: "MessageSquare" },
    { id: "clubs", label: "Clubs", icon: "Trophy" },
    { id: "health", label: "Health", icon: "HeartPulse" },
    { id: "premium", label: "Roadmap", icon: "Crown" },
    { id: "badges", label: "Badges", icon: "BadgeCheck" },
    { id: "crons", label: "Crons", icon: "Clock" },
    { id: "server", label: "Server", icon: "Terminal" },
    { id: "security", label: "Security", icon: "Shield" },
    { id: "seo", label: "SEO Pages", icon: "Globe" },
    { id: "import-errors", label: "Import Errors", icon: "AlertTriangle" },
    { id: "email-analytics", label: "Email Analytics", icon: "Mail" },
  ],
};

/** Debounced save to DB — avoids spamming during rapid customization */
function useDebouncedDbSync(prefs: UserDashboardPrefs, userId: string | undefined) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    if (!userId) return;

    const serialized = JSON.stringify(prefs);
    // Skip if nothing changed
    if (serialized === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("user_dashboard_prefs")
          .upsert({
            user_id: userId,
            tab_order: prefs.tabOrder,
            hidden_tabs: prefs.hiddenTabs,
            widget_order: prefs.widgetOrder as any,
            hidden_widgets: prefs.hiddenWidgets as any,
            widget_sizes: prefs.widgetSizes as any,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (error) {
          console.warn("Failed to save dashboard prefs to DB:", error);
        } else {
          lastSavedRef.current = serialized;
        }
      } catch (e) {
        console.warn("Dashboard prefs DB sync error:", e);
      }
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prefs, userId]);
}

export function useUserDashboardPrefs(isAdmin: boolean, isStaff: boolean = false) {
  const isAdminOrStaff = isAdmin || isStaff;
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserDashboardPrefs>(loadPrefs);
  const dbLoadedRef = useRef(false);

  // On mount, load prefs from DB if user is logged in
  useEffect(() => {
    if (!user?.id || dbLoadedRef.current) return;
    dbLoadedRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_dashboard_prefs")
          .select("tab_order, hidden_tabs, widget_order, hidden_widgets, widget_sizes, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("Failed to load dashboard prefs from DB:", error);
          return;
        }

        if (!data) {
          // No DB prefs yet — push current localStorage prefs to DB on first load
          // This handles migration for existing users
          const localPrefs = loadPrefs();
          const isEmpty = localPrefs.tabOrder.length === 0 &&
            localPrefs.hiddenTabs.length === 0 &&
            Object.keys(localPrefs.widgetOrder).length === 0 &&
            Object.keys(localPrefs.hiddenWidgets).length === 0;

          if (!isEmpty) {
            // Upload local prefs to DB for cross-platform sync
            await supabase
              .from("user_dashboard_prefs")
              .upsert({
                user_id: user.id,
                tab_order: localPrefs.tabOrder,
                hidden_tabs: localPrefs.hiddenTabs,
                widget_order: localPrefs.widgetOrder as any,
                hidden_widgets: localPrefs.hiddenWidgets as any,
                widget_sizes: localPrefs.widgetSizes as any,
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" })
              .then(({ error: e }) => {
                if (e) console.warn("Failed to seed DB prefs:", e);
              });
          }
          return;
        }

        // DB has prefs — compare timestamps to decide which wins
        const localRaw = localStorage.getItem(STORAGE_KEY + "-ts");
        const localTs = localRaw ? parseInt(localRaw, 10) : 0;
        const dbTs = data.updated_at ? new Date(data.updated_at).getTime() : 0;

        // DB is newer (or same) — use DB prefs
        if (dbTs >= localTs) {
          const dbPrefs: UserDashboardPrefs = {
            tabOrder: (data.tab_order as string[]) ?? [],
            hiddenTabs: (data.hidden_tabs as string[]) ?? [],
            widgetOrder: (data.widget_order as Record<string, string[]>) ?? {},
            hiddenWidgets: (data.hidden_widgets as Record<string, string[]>) ?? {},
            widgetSizes: (data.widget_sizes as Record<string, Record<string, number>>) ?? {},
          };
          setPrefs(dbPrefs);
          savePrefsLocal(dbPrefs);
          localStorage.setItem(STORAGE_KEY + "-ts", String(dbTs));
        }
        // else: local is newer — keep local, DB will be updated via debounced sync
      } catch (e) {
        console.warn("Dashboard prefs load error:", e);
      }
    })();
  }, [user?.id]);

  // Debounced sync to DB whenever prefs change
  useDebouncedDbSync(prefs, user?.id);

  const update = useCallback((updater: (prev: UserDashboardPrefs) => UserDashboardPrefs) => {
    setPrefs(prev => {
      const next = updater(prev);
      savePrefsLocal(next);
      // Store local timestamp for conflict resolution
      localStorage.setItem(STORAGE_KEY + "-ts", String(Date.now()));
      return next;
    });
  }, []);

  /** Visible tabs in user's preferred order */
  const visibleTabs = useMemo(() => {
    const allTabs = DASHBOARD_TABS.filter(t => !t.adminOnly || isAdminOrStaff);
    const hidden = new Set(prefs.hiddenTabs);

    if (prefs.tabOrder.length > 0) {
      const ordered: DashboardTabDef[] = [];
      const seen = new Set<string>();

      for (const id of prefs.tabOrder) {
        const tab = allTabs.find(t => t.id === id);
        if (tab && !hidden.has(id)) {
          ordered.push(tab);
          seen.add(id);
        }
      }
      for (const tab of allTabs) {
        if (!seen.has(tab.id) && !hidden.has(tab.id)) {
          ordered.push(tab);
        }
      }
      return ordered;
    }

    return allTabs.filter(t => !hidden.has(t.id));
  }, [prefs, isAdminOrStaff]);

  const allTabs = useMemo(
    () => DASHBOARD_TABS.filter(t => !t.adminOnly || isAdminOrStaff),
    [isAdminOrStaff]
  );

  const hiddenTabDefs = useMemo(
    () => allTabs.filter(t => prefs.hiddenTabs.includes(t.id)),
    [allTabs, prefs.hiddenTabs]
  );

  const toggleTab = useCallback((tabId: string) => {
    update(prev => ({
      ...prev,
      hiddenTabs: prev.hiddenTabs.includes(tabId)
        ? prev.hiddenTabs.filter(id => id !== tabId)
        : [...prev.hiddenTabs, tabId],
    }));
  }, [update]);

  const reorderTabs = useCallback((newOrder: string[]) => {
    update(prev => ({ ...prev, tabOrder: newOrder }));
  }, [update]);

  const moveTab = useCallback((tabId: string, direction: -1 | 1) => {
    const currentOrder = visibleTabs.map(t => t.id);
    const idx = currentOrder.indexOf(tabId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= currentOrder.length) return;
    const newOrder = [...currentOrder];
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    reorderTabs(newOrder);
  }, [visibleTabs, reorderTabs]);

  const resetPrefs = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + "-ts");
    setPrefs(EMPTY_PREFS);
    // Also clear DB prefs
    if (user?.id) {
      supabase
        .from("user_dashboard_prefs")
        .delete()
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.warn("Failed to clear DB prefs:", error);
        });
    }
  }, [user?.id]);

  // ── Per-tab widget customization ──

  /** Get visible widget IDs for a tab in user's preferred order */
  const getVisibleWidgets = useCallback((tabId: string): string[] => {
    const registry = TAB_WIDGET_REGISTRY[tabId];
    if (!registry) return [];
    const defaultOrder = registry.map(w => w.id);
    const userOrder = prefs.widgetOrder[tabId] ?? [];
    const hiddenSet = new Set(prefs.hiddenWidgets[tabId] ?? []);

    if (userOrder.length > 0) {
      const result: string[] = [];
      const seen = new Set<string>();
      for (const id of userOrder) {
        if (defaultOrder.includes(id) && !hiddenSet.has(id)) {
          result.push(id);
          seen.add(id);
        }
      }
      // Append any new widgets not in saved order
      for (const id of defaultOrder) {
        if (!seen.has(id) && !hiddenSet.has(id)) {
          result.push(id);
        }
      }
      return result;
    }

    return defaultOrder.filter(id => !hiddenSet.has(id));
  }, [prefs]);

  /** Get hidden widget defs for a tab */
  const getHiddenWidgets = useCallback((tabId: string): WidgetDef[] => {
    const registry = TAB_WIDGET_REGISTRY[tabId];
    if (!registry) return [];
    const hiddenSet = new Set(prefs.hiddenWidgets[tabId] ?? []);
    return registry.filter(w => hiddenSet.has(w.id));
  }, [prefs]);

  /** Toggle a widget's visibility within a tab */
  const toggleWidget = useCallback((tabId: string, widgetId: string) => {
    update(prev => {
      const current = prev.hiddenWidgets[tabId] ?? [];
      const next = current.includes(widgetId)
        ? current.filter(id => id !== widgetId)
        : [...current, widgetId];
      return {
        ...prev,
        hiddenWidgets: { ...prev.hiddenWidgets, [tabId]: next },
      };
    });
  }, [update]);

  /** Reorder widgets within a tab */
  const reorderWidgets = useCallback((tabId: string, newOrder: string[]) => {
    update(prev => ({
      ...prev,
      widgetOrder: { ...prev.widgetOrder, [tabId]: newOrder },
    }));
  }, [update]);

  /** Move a widget up or down within a tab */
  const moveWidget = useCallback((tabId: string, widgetId: string, direction: -1 | 1) => {
    const visible = getVisibleWidgets(tabId);
    const idx = visible.indexOf(widgetId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= visible.length) return;
    const newOrder = [...visible];
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    // Include hidden widgets in the full order to preserve their positions
    const registry = TAB_WIDGET_REGISTRY[tabId] ?? [];
    const hiddenIds = (prefs.hiddenWidgets[tabId] ?? []).filter(id => registry.some(w => w.id === id));
    reorderWidgets(tabId, [...newOrder, ...hiddenIds]);
  }, [getVisibleWidgets, reorderWidgets, prefs.hiddenWidgets]);

  /** Reset widget customization for a specific tab */
  const resetTabWidgets = useCallback((tabId: string) => {
    update(prev => {
      const { [tabId]: _wo, ...restOrder } = prev.widgetOrder;
      const { [tabId]: _hw, ...restHidden } = prev.hiddenWidgets;
      const { [tabId]: _ws, ...restSizes } = prev.widgetSizes;
      return { ...prev, widgetOrder: restOrder, hiddenWidgets: restHidden, widgetSizes: restSizes };
    });
  }, [update]);

  // ── Per-tab widget sizing ──

  /** Get column span for a widget (default: 3 = full width in a 3-col grid) */
  const getWidgetSize = useCallback((tabId: string, widgetId: string): number => {
    return prefs.widgetSizes[tabId]?.[widgetId] ?? 3;
  }, [prefs]);

  /** Set column span for a widget (1, 2, or 3) */
  const setWidgetSize = useCallback((tabId: string, widgetId: string, colSpan: number) => {
    const clamped = Math.max(1, Math.min(3, colSpan));
    update(prev => ({
      ...prev,
      widgetSizes: {
        ...prev.widgetSizes,
        [tabId]: { ...(prev.widgetSizes[tabId] ?? {}), [widgetId]: clamped },
      },
    }));
  }, [update]);

  return {
    prefs,
    visibleTabs,
    allTabs,
    hiddenTabDefs,
    toggleTab,
    reorderTabs,
    moveTab,
    resetPrefs,
    isTabHidden: (id: string) => prefs.hiddenTabs.includes(id),
    // Per-tab widget methods
    getVisibleWidgets,
    getHiddenWidgets,
    toggleWidget,
    reorderWidgets,
    moveWidget,
    resetTabWidgets,
    // Per-tab widget sizing
    getWidgetSize,
    setWidgetSize,
  };
}
