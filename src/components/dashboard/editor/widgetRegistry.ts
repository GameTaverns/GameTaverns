import type { WidgetDef } from "./types";

/**
 * Master registry of ALL dashboard widgets.
 * Each widget can appear in any tab via the layout editor.
 */
export const WIDGET_REGISTRY: WidgetDef[] = [
  // --- Overview widgets ---
  { id: "import-progress", label: "Import Progress", icon: "Upload", description: "Shows active import jobs" },
  { id: "onboarding", label: "Getting Started", icon: "Activity", description: "Onboarding checklist for new users" },
  { id: "lending", label: "Game Lending", icon: "BookOpen", description: "Lending dashboard with pending requests" },
  { id: "messages", label: "Messages", icon: "Mail", description: "Unread message summary" },
  { id: "borrowed", label: "My Borrowed Games", icon: "BookOpen", description: "Games currently borrowed" },
  { id: "communities", label: "My Communities", icon: "Users", description: "Libraries and memberships" },
  { id: "achievements", label: "Achievements", icon: "Trophy", description: "User achievement display" },
  { id: "shelf-of-shame", label: "Shelf of Shame", icon: "Gamepad2", description: "Unplayed games widget" },
  { id: "events", label: "Events", icon: "Calendar", description: "Upcoming library events" },
  { id: "polls", label: "Game Polls", icon: "Vote", description: "Poll creation and management" },
  { id: "inquiries", label: "My Inquiries", icon: "MessageSquare", description: "Sent game inquiries" },
  { id: "explore", label: "Explore Checklist", icon: "Star", description: "Feature discovery checklist" },
  { id: "ratings-wishlist", label: "Ratings & Wishlist", icon: "Star", description: "Quick links to ratings and wishlist" },
  { id: "challenges", label: "Group Challenges", icon: "Target", description: "Community challenges manager" },
  { id: "random-picker", label: "Random Game Picker", icon: "Target", description: "Pick a random game from library" },
  { id: "create-library", label: "Create Another Library", icon: "Plus", description: "Create additional library slot" },

  // --- Community widgets ---
  { id: "forums", label: "Forums", icon: "MessageSquare", description: "Community forum threads" },
  { id: "clubs", label: "My Clubs", icon: "Users", description: "Club management and listing" },
  { id: "community-members", label: "Community Members", icon: "Users", description: "Member management panel" },

  // --- More widgets ---
  { id: "trades", label: "Cross-Library Trading", icon: "ArrowLeftRight", description: "Trade center for cross-library swaps" },
  { id: "analytics", label: "Analytics", icon: "BarChart3", description: "Library and platform analytics" },
  { id: "catalog", label: "Game Catalog", icon: "BookOpen", description: "Browse the game catalog", adminOnly: true },
  { id: "account-settings", label: "Account Settings", icon: "Settings", description: "Profile and login management" },
  { id: "danger-zone", label: "Danger Zone", icon: "AlertTriangle", description: "Destructive actions (delete account, etc.)" },
];

export const WIDGET_MAP = new Map(WIDGET_REGISTRY.map(w => [w.id, w]));

export const DEFAULT_LAYOUT = {
  tabs: [
    {
      id: "overview",
      label: "Overview",
      icon: "Activity",
      widgets: [
        "import-progress", "onboarding", "lending", "messages", "borrowed",
        "communities", "achievements", "shelf-of-shame", "events", "polls",
        "inquiries", "explore", "ratings-wishlist", "challenges", "random-picker",
        "create-library",
      ],
    },
    {
      id: "community",
      label: "Community",
      icon: "MessageSquare",
      widgets: ["forums", "clubs", "community-members"],
    },
    {
      id: "more",
      label: "More",
      icon: "Zap",
      widgets: ["trades", "analytics", "catalog", "account-settings", "danger-zone"],
    },
  ],
};

/** Icon name options for tabs */
export const TAB_ICON_OPTIONS = [
  "Activity", "Zap", "MessageSquare", "Users", "Settings", "Star",
  "Trophy", "BookOpen", "Calendar", "BarChart3", "Target", "Heart",
  "Shield", "Globe", "Mail", "Gamepad2", "Vote", "Upload",
  "ArrowLeftRight", "AlertTriangle", "Plus", "DollarSign", "Palette",
];
