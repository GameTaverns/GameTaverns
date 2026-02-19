import { useEffect, useRef, useCallback, forwardRef, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTurnstileSiteKey, useSiteSettingsLoaded } from "@/hooks/useSiteSettings";
import { Capacitor } from "@capacitor/core";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Detect if we're running in a Lovable preview environment OR native Capacitor app.
 * Turnstile cannot run inside a native WebView (capacitor:// scheme blocks Cloudflare JS).
 * The backend validates the secret key on all requests regardless.
 */
function isLovablePreview(): boolean {
  if (typeof window === "undefined") return false;
  // Native apps: Turnstile widget cannot load inside Capacitor WebView
  if (Capacitor.isNativePlatform()) return true;
  const host = window.location.hostname;
  // Lovable preview domains
  if (host.endsWith(".lovableproject.com") || host.endsWith(".lovable.app")) return true;
  // Dev server on localhost (but NOT native)
  if (host === "localhost" || host === "127.0.0.1") return true;
  return false;
}

/**
 * Detect if we're running in the self-hosted Supabase stack (same-origin Kong).
 * In this deployment, we should fail open (with a short safety delay) if
 * site settings can't be fetched / the Turnstile key isn't available.
 */
function isSelfHostedSupabaseStack(): boolean {
  if (typeof window === "undefined") return false;
  const runtime = (window as any).__RUNTIME_CONFIG__ as
    | { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SELF_HOSTED?: boolean }
    | undefined;

  // The self-hosted stack injects __RUNTIME_CONFIG__ with its own SUPABASE_URL/KEY.
  // SELF_HOSTED may be true, false, or undefined depending on version — check the URL instead.
  if (!runtime) return false;
  if (!runtime.SUPABASE_URL || !runtime.SUPABASE_ANON_KEY) return false;
  // If the runtime config points to a non-supabase.co URL, it's self-hosted
  const url = runtime.SUPABASE_URL;
  return !url.includes(".supabase.co");
}

let turnstileLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]'
    );

    const waitForGlobal = (timeoutMs = 10000) => {
      const start = Date.now();
      const interval = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(interval);
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          window.clearInterval(interval);
          reject(new Error("Turnstile did not initialize"));
        }
      }, 100);
    };

    if (existingScript) {
      waitForGlobal();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => waitForGlobal();
    script.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(script);
  }).finally(() => {
    if (!window.turnstile) turnstileLoadPromise = null;
  });

  return turnstileLoadPromise;
}

export const TurnstileWidget = forwardRef<HTMLDivElement, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onExpire, onError }, _ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [bypassReason, setBypassReason] = useState<string | null>(null);
    
    // Check for Lovable preview / native FIRST, before any other logic
    const isPreviewMode = isLovablePreview();
    const isNative = Capacitor.isNativePlatform();
    
    // Only use site settings if NOT in preview mode
    const siteKey = useTurnstileSiteKey();
    const settingsLoaded = useSiteSettingsLoaded();

    // Preview/native bypass - runs once on mount, takes priority over everything
    useEffect(() => {
      if (!isPreviewMode) return;
      
      // Immediately set bypass state
      setBypassReason(isNative ? "native app" : "preview mode");
      setIsLoading(false);
      setHasError(false);
      
      // Call onVerify with bypass token after a short delay
      const timer = setTimeout(() => {
        onVerify("TURNSTILE_BYPASS_TOKEN");
      }, 300);
      
      return () => clearTimeout(timer);
    }, [isPreviewMode, isNative, onVerify]);

    // Safety timeout: if settings haven't loaded after 8s and NOT in preview, show error
    useEffect(() => {
      if (isPreviewMode || settingsLoaded || bypassReason) return;
      
      const timeout = setTimeout(() => {
        if (!settingsLoaded && !bypassReason && !isPreviewMode) {
          console.warn('[TurnstileWidget] Settings timeout - cannot load verification config');
          setHasError(true);
          setIsLoading(false);
          onError?.();
        }
      }, 8000);
      
      return () => clearTimeout(timeout);
    }, [settingsLoaded, bypassReason, isPreviewMode, onError]);

    // Handle site key availability (only for non-preview environments)
    useEffect(() => {
      // Skip if in preview mode - already handled above
      if (isPreviewMode) return;

      // Don't make decisions until settings are loaded
      if (!settingsLoaded) return;
      
      // If no site key is configured after settings loaded, show error
      if (!siteKey) {
        // Self-hosted safety fallback: allow login/signup to work even if
        // the settings table/view is missing or the API is temporarily down.
        if (isSelfHostedSupabaseStack()) {
          console.warn('[TurnstileWidget] Self-hosted fallback: missing Turnstile site key, bypassing after safety delay');
          setBypassReason("self-hosted safety fallback");
          setHasError(false);
          setIsLoading(false);

          const timer = setTimeout(() => {
            onVerify("TURNSTILE_BYPASS_TOKEN");
          }, 1000);

          return () => clearTimeout(timer);
        }

        console.warn('[TurnstileWidget] No Turnstile site key configured — bypassing verification');
        setBypassReason("no site key configured");
        setHasError(false);
        setIsLoading(false);
        const timer = setTimeout(() => {
          onVerify("TURNSTILE_BYPASS_TOKEN");
        }, 300);
        return () => clearTimeout(timer);
      }
      
      // Site key exists - proceed with real Turnstile
      setBypassReason(null);
      setHasError(false);
    }, [settingsLoaded, siteKey, isPreviewMode, onError, onVerify]);

    const handleVerify = useCallback((token: string) => {
      setIsLoading(false);
      onVerify(token);
    }, [onVerify]);

    const handleError = useCallback(() => {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    }, [onError]);

    const renderWidget = useCallback(() => {
      if (!containerRef.current || !window.turnstile || !siteKey) return;
      
      if (widgetIdRef.current) {
        return;
      }

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: handleVerify,
          "expired-callback": onExpire,
          "error-callback": handleError,
          theme: "auto",
          size: "normal",
        });
        setTimeout(() => setIsLoading(false), 500);
      } catch (err) {
        console.error("Turnstile render error:", err);
        setHasError(true);
        setIsLoading(false);
      }
    }, [handleVerify, onExpire, handleError, siteKey]);

    useEffect(() => {
      // Don't load Turnstile if in preview mode or no site key
      if (isPreviewMode || !settingsLoaded || !siteKey) return;

      setIsLoading(true);
      setHasError(false);

      let cancelled = false;

      (async () => {
        try {
          await loadTurnstileScript();
          if (cancelled) return;
          renderWidget();
        } catch (e) {
          if (cancelled) return;
          console.error("Turnstile load error:", e);
          setHasError(true);
          setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch (e) {}
          widgetIdRef.current = null;
        }
      };
    }, [renderWidget, settingsLoaded, siteKey, isPreviewMode]);

    // Preview/native bypass: show a simple indicator (check FIRST, before settings loading)
    if (isPreviewMode) {
      return (
        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-muted/50 border border-border/50">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Verification bypassed ({isNative ? "native app" : "preview mode"})
          </span>
        </div>
      );
    }

    // Self-hosted safety fallback: show indicator while we bypass.
    if (bypassReason === "self-hosted safety fallback") {
      return (
        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-muted/50 border border-border/50">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Verification bypassed (self-hosted safety fallback)
          </span>
        </div>
      );
    }

    // Still loading settings - show loading state
    if (!settingsLoaded) {
      return (
        <div className="flex items-center justify-center min-h-[65px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading verification...</span>
          </div>
        </div>
      );
    }

    // Missing key or settings issue
    if (hasError && !isLoading) {
      return (
        <div className="w-full">
          <div className="w-[300px] mx-auto">
            <Skeleton className="h-[65px] rounded" />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Verification is not available right now. Please try again shortly.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex justify-center min-h-[65px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading verification...</span>
            </div>
          </div>
        )}
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[300px]">
              <Skeleton className="h-[65px] rounded" />
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Verification failed to load. Please refresh or try again.
              </p>
            </div>
          </div>
        )}
        <div 
          ref={containerRef} 
          className={isLoading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}
          data-turnstile-container="true"
        />
      </div>
    );
  }
);
