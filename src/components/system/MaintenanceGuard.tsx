import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import Maintenance from "@/pages/Maintenance";

interface MaintenanceGuardProps {
  children: ReactNode;
}

// Routes that should always be accessible during maintenance
const ALLOWED_ROUTES = ["/login", "/forgot-password", "/reset-password"];

export function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  const { showMaintenancePage, isLoading } = useMaintenanceMode();
  const location = useLocation();

  // Check if current route is in the allowed list
  const isAllowedRoute = ALLOWED_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith(route)
  );

  // During loading, show a minimal loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If maintenance mode is on, user is not admin, and route is not allowed
  if (showMaintenancePage && !isAllowedRoute) {
    return <Maintenance />;
  }

  // Otherwise, render the app normally
  return <>{children}</>;
}
