import { useState, useCallback, useMemo } from "react";

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

function savePrefs(prefs: UserDashboardPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * All available dashboard tabs with their default config.
 */
export interface DashboardTabDef {
  id: string;
  label: string;
  icon: string;
  /** If true, only visible to admins */
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
  ],
};

export function useUserDashboardPrefs(isAdmin: boolean) {
  const [prefs, setPrefs] = useState<UserDashboardPrefs>(loadPrefs);

  const update = useCallback((updater: (prev: UserDashboardPrefs) => UserDashboardPrefs) => {
    setPrefs(prev => {
      const next = updater(prev);
      savePrefs(next);
      return next;
    });
  }, []);

  /** Visible tabs in user's preferred order */
  const visibleTabs = useMemo(() => {
    const allTabs = DASHBOARD_TABS.filter(t => !t.adminOnly || isAdmin);
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
  }, [prefs, isAdmin]);

  const allTabs = useMemo(
    () => DASHBOARD_TABS.filter(t => !t.adminOnly || isAdmin),
    [isAdmin]
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
    setPrefs(EMPTY_PREFS);
  }, []);

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
