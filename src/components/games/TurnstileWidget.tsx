import { useEffect, useRef, useCallback, forwardRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
      // Script already present; just wait for `window.turnstile`.
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
    // Allow retry if it failed
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
    const siteKey = useTurnstileSiteKey();

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
        // Widget rendered, but still loading until verified or shown
        setTimeout(() => setIsLoading(false), 500);
      } catch (err) {
        console.error("Turnstile render error:", err);
        setHasError(true);
        setIsLoading(false);
      }
    }, [handleVerify, onExpire, handleError, siteKey]);

    useEffect(() => {
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
                Verification failed to load in preview. This usually means the Turnstile script is
                blocked (CSP/ad-block) or the preview hostname isn’t allowed in your Turnstile
                settings.
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
