import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useDemoMode } from "@/contexts/DemoContext";

interface DemoGuardProps {
  children: React.ReactNode;
}

/**
 * Guards demo routes - redirects to home if demo mode feature is disabled.
 * Only applies when NOT already in demo mode (prevents blocking users who
 * navigated to demo before it was disabled).
 */
export function DemoGuard({ children }: DemoGuardProps) {
  const { demoMode: demoModeEnabled, isLoading } = useFeatureFlags();
  const { isDemoMode } = useDemoMode();

  // While loading, show nothing to prevent flash
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If demo mode is disabled and user is trying to access demo routes, redirect
  if (!demoModeEnabled && !isDemoMode) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
