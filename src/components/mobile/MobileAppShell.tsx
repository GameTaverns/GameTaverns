import { useEffect, useState } from "react";
import { useCapacitor, useMobileLibrary } from "@/hooks/useCapacitor";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { MobileLibrarySelector } from "./MobileLibrarySelector";
import { WifiOff, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

interface MobileAppShellProps {
  children: React.ReactNode;
}

export function MobileAppShell({ children }: MobileAppShellProps) {
  const { isNative, platform, isOnline } = useCapacitor();
  const { activeLibrary, isLoadingLibrary, selectLibrary, clearLibrary } = useMobileLibrary();
  const { isSupported: pushSupported, isRegistered, requestPermission } = usePushNotifications();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [promptedForPush, setPromptedForPush] = useState(false);

  // Handle offline state
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineNotice(true);
      toast.warning("You're offline", {
        description: "Some features may not be available.",
        duration: 5000,
      });
    } else if (showOfflineNotice) {
      setShowOfflineNotice(false);
      toast.success("Back online");
    }
  }, [isOnline, showOfflineNotice]);

  // Prompt for push notifications on first launch
  useEffect(() => {
    if (!isNative || promptedForPush || !pushSupported) return;
    
    // Wait a bit before prompting
    const timer = setTimeout(async () => {
      if (!isRegistered) {
        const granted = await requestPermission();
        if (granted) {
          toast.success("Notifications enabled", {
            description: "You'll receive updates about game nights and new additions.",
          });
        }
      }
      setPromptedForPush(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isNative, promptedForPush, pushSupported, isRegistered, requestPermission]);

  // On native platforms, check URL params first (for deep links)
  useEffect(() => {
    if (!isNative) return;
    
    const params = new URLSearchParams(window.location.search);
    const tenantFromUrl = params.get('tenant');
    
    if (tenantFromUrl && tenantFromUrl !== activeLibrary) {
      selectLibrary(tenantFromUrl);
    }
  }, [isNative, activeLibrary, selectLibrary]);

  // Redirect authenticated users to dashboard on native launch
  useEffect(() => {
    if (!isNative || authLoading) return;
    if (isAuthenticated && !activeLibrary && !isLoadingLibrary) {
      // Authenticated users without a library selected go to their dashboard
      navigate("/dashboard", { replace: true });
    }
  }, [isNative, isAuthenticated, authLoading, activeLibrary, isLoadingLibrary, navigate]);

  // Wait for both auth and storage to load on native before deciding what to show
  if (isNative && (authLoading || isLoadingLibrary)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If native, authenticated, and no library selected — redirect handled by useEffect above
  // Show nothing while redirect is in progress
  if (isNative && isAuthenticated && !activeLibrary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If native and no library selected and not authenticated, show selector with sign-in option
  if (isNative && !activeLibrary) {
    const params = new URLSearchParams(window.location.search);
    const tenantFromUrl = params.get('tenant');
    
    if (!tenantFromUrl) {
      return <MobileLibrarySelector onLibrarySelected={selectLibrary} />;
    }
  }

  return (
    <div className={`mobile-app-shell ${platform}`}>
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground py-2 px-4 flex items-center justify-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" />
          <span>You're offline</span>
        </div>
      )}

      {/* Native notification permission banner */}
      {isNative && pushSupported && !isRegistered && !promptedForPush && (
        <div className="fixed bottom-20 left-4 right-4 z-40 bg-card border rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">Enable Notifications</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Get notified about game nights, new games, and more.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={requestPermission}>
                  Enable
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setPromptedForPush(true)}
                >
                  <BellOff className="h-4 w-4 mr-1" />
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
