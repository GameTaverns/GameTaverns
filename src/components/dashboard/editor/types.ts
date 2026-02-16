import { type LucideIcon } from "lucide-react";

export interface TabConfig {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  widgets: string[];
}

export interface DashboardLayoutConfig {
  tabs: TabConfig[];
}

export interface WidgetDef {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  description?: string;
  adminOnly?: boolean;
}
