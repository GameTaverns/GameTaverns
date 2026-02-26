import { useEffect, useState, useCallback, Component, type ReactNode } from "react";
import { useCapacitor, useMobileLibrary } from "@/hooks/useCapacitor";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { MobileLibrarySelector } from "./MobileLibrarySelector";
import { WifiOff, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

// Error boundary to catch any crash inside the shell
class MobileErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-4">
          <p className="text-destructive text-sm font-medium">Something went wrong</p>
          <p className="text-muted-foreground text-xs text-center">{this.state.error}</p>
          <Button variant="outline" onClick={() => this.setState({ hasError: false, error: "" })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface MobileAppShellProps {
  children: ReactNode;
}

function MobileAppShellInner({ children }: MobileAppShellProps) {
  const { isNative, platform, isOnline } = useCapacitor();
  const { activeLibrary, isLoadingLibrary, selectLibrary } = useMobileLibrary();
  const { isSupported: pushSupported, isRegistered, requestPermission } = usePushNotifications();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const navigate = useNavigate();
  const location = useLocation();
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [promptedForPush, setPromptedForPush] = useState(false);

  // Global safety net: prevent unhandled promise rejections from crashing the app
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled promise rejection caught by MobileAppShell:', event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

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

  const handleEnablePush = useCallback(async () => {
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success("Notifications enabled", {
          description: "You'll receive updates about game nights and new additions.",
        });
      } else {
        toast.info("Notifications not enabled", {
          description: "You can enable them later in your device settings.",
        });
      }
    } catch (e) {
      console.warn("Push notification request failed:", e);
      toast.error("Could not enable notifications right now");
    } finally {
      setPromptedForPush(true);
    }
  }, [requestPermission]);

  // Prompt for push notifications — DON'T auto-prompt on first launch.
  // This was causing crashes on some Android devices. Instead, we only
  // prompt when the user explicitly taps the bell icon.
  // The bell icon is shown in the notification banner below.

  // Handle deep link tenant param — use React Router location.search (works with HashRouter)
  // On native/HashRouter, window.location.search is always empty; location.search is correct.
  useEffect(() => {
    if (!isNative) return;
    const params = new URLSearchParams(location.search);
    const tenantFromUrl = params.get('tenant');
    if (tenantFromUrl && tenantFromUrl !== activeLibrary) {
      selectLibrary(tenantFromUrl);
    }
  }, [isNative, location.search, activeLibrary, selectLibrary]);

  // After login on native, auto-select the user's primary library so that
  // tenant context is set without requiring the library selector.
  useEffect(() => {
    if (!isNative || !isAuthenticated || activeLibrary || !myLibrary?.slug) return;
    selectLibrary(myLibrary.slug);
  }, [isNative, isAuthenticated, activeLibrary, myLibrary?.slug, selectLibrary]);

  // Redirect authenticated users to dashboard if no library selected
  useEffect(() => {
    if (!isNative || authLoading || isLoadingLibrary) return;
    if (isAuthenticated && !activeLibrary) {
      try {
        navigate("/dashboard", { replace: true });
      } catch (e) {
        console.warn("Navigation failed:", e);
      }
    }
  }, [isNative, isAuthenticated, authLoading, activeLibrary, isLoadingLibrary, navigate]);

  // Only show the initial loading splash while auth is still bootstrapping
  // (authLoading=true on first mount). Never block rendering after login completes.
  if (isNative && authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Authenticated but no library yet — show brief loading while redirect fires.
  // Cap this at a short window: if navigate() fails, fall through to children.
  // IMPORTANT: Do NOT block platform paths (/dashboard, /catalog, /dm, etc.)
  const SHELL_PLATFORM_PATHS = [
    '/dashboard', '/catalog', '/dm', '/docs', '/directory', '/achievements',
    '/community', '/club', '/u/', '/lists', '/create-library',
    '/login', '/signup', '/legal', '/privacy', '/terms', '/cookies',
    '/features', '/press', '/install',
  ];
  const isOnPlatformPath = SHELL_PLATFORM_PATHS.some(
    p => location.pathname === p || location.pathname.startsWith(p)
  );
  if (isNative && isAuthenticated && !activeLibrary && !isOnPlatformPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Not authenticated and no library — show selector, unless the user is
  // navigating to an auth route (login, signup, forgot-password, reset-password),
  // OR is already authenticated (they'll be redirected to dashboard by the effect above).
  const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/legal', '/privacy', '/terms', '/cookies', '/docs', '/directory'];
  const isAuthPath = AUTH_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p));

  if (isNative && !isAuthenticated && !activeLibrary && !isAuthPath) {
    const params = new URLSearchParams(location.search);
    const tenantFromUrl = params.get('tenant');
    if (!tenantFromUrl) {
      return <MobileLibrarySelector onLibrarySelected={selectLibrary} />;
    }
  }

  return (
    <div className={`mobile-app-shell ${platform}`}>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground py-2 px-4 flex items-center justify-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" />
          <span>You're offline</span>
        </div>
      )}

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
                <Button size="sm" onClick={handleEnablePush}>Enable</Button>
                <Button size="sm" variant="ghost" onClick={() => setPromptedForPush(true)}>
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

export function MobileAppShell({ children }: MobileAppShellProps) {
  return (
    <MobileErrorBoundary>
      <MobileAppShellInner>{children}</MobileAppShellInner>
    </MobileErrorBoundary>
  );
}
