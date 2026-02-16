import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import type { DashboardLayoutConfig } from "@/components/dashboard/editor/types";
import { DEFAULT_LAYOUT } from "@/components/dashboard/editor/widgetRegistry";

const QUERY_KEY = ["dashboard-layout"];

export function useDashboardLayout() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<DashboardLayoutConfig> => {
      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("config")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[DashboardLayout] Failed to load layout, using default", error);
        return DEFAULT_LAYOUT;
      }

      if (!data?.config) return DEFAULT_LAYOUT;

      // Validate shape
      const cfg = data.config as any;
      if (!cfg.tabs || !Array.isArray(cfg.tabs)) return DEFAULT_LAYOUT;
      return cfg as DashboardLayoutConfig;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useSaveDashboardLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: DashboardLayoutConfig) => {
      // Get the existing row id
      const { data: existing } = await supabase
        .from("dashboard_layouts")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("dashboard_layouts")
          .update({
            config: config as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dashboard_layouts")
          .insert({ config: config as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
