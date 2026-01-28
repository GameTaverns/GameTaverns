import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMaintenanceMode() {
  const { isAdmin, loading: authLoading, roleLoading } = useAuth();

  // Fetch maintenance mode setting
  const { data: isMaintenanceMode, isLoading: settingLoading } = useQuery({
    queryKey: ["maintenance-mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      if (error) {
        console.error("Error fetching maintenance mode:", error);
        return false;
      }

      return data?.value === "true";
    },
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });

  const isLoading = authLoading || roleLoading || settingLoading;
  
  // Show maintenance page if:
  // 1. Maintenance mode is enabled AND
  // 2. User is NOT an admin
  const showMaintenancePage = !isLoading && isMaintenanceMode === true && !isAdmin;

  return {
    isMaintenanceMode: isMaintenanceMode ?? false,
    showMaintenancePage,
    isLoading,
    isAdmin,
  };
}
