import { useEffect, useRef, useCallback, forwardRef, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTurnstileSiteKey } from "@/hooks/useSiteSettings";

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
 * Detect if we're running in an environment where Turnstile should be bypassed:
 * - Lovable preview environments (always bypass)
 * - When no Turnstile site key is configured
 * 
 * Note: Self-hosted mode CAN have Turnstile if configured in the database
 */
function shouldBypassTurnstile(siteKey?: string): boolean {
  if (typeof window === "undefined") return false;
  
  // Lovable preview domains - always bypass
  const host = window.location.hostname;
  if (host.endsWith(".lovableproject.com") || host.endsWith(".lovable.app")) {
    return true;
  }
  
  // If no site key is configured, bypass
  if (!siteKey) {
    return true;
  }
  
  return false;
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
    const [isPreview, setIsPreview] = useState(false);
    const siteKey = useTurnstileSiteKey();

    // Check for bypass environment and auto-verify
    useEffect(() => {
      if (shouldBypassTurnstile(siteKey)) {
        setIsPreview(true);
        setIsLoading(false);
        // Auto-verify with a bypass token after a brief delay
        const timer = setTimeout(() => {
          onVerify("TURNSTILE_BYPASS_TOKEN");
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [onVerify, siteKey]);

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
      // Skip loading Turnstile in bypass mode
      if (shouldBypassTurnstile(siteKey)) return;

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
    }, [renderWidget]);

    // Bypass mode: show a simple indicator
    if (isPreview) {
      const bypassReason = !siteKey ? "no site key configured" : "preview mode";
      return (
        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-muted/50 border border-border/50">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Verification bypassed ({bypassReason})
          </span>
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
