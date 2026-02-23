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
}

const EMPTY_PREFS: UserDashboardPrefs = {
  tabOrder: [],
  hiddenTabs: [],
  widgetOrder: {},
  hiddenWidgets: {},
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
 * This is the source of truth for what tabs exist.
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

    // If user has a custom order, use it (filtering out unknown/hidden)
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
      // Append any new tabs not in the saved order
      for (const tab of allTabs) {
        if (!seen.has(tab.id) && !hidden.has(tab.id)) {
          ordered.push(tab);
        }
      }
      return ordered;
    }

    return allTabs.filter(t => !hidden.has(t.id));
  }, [prefs, isAdmin]);

  /** All tabs including hidden ones (for the customization panel) */
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
  };
}
