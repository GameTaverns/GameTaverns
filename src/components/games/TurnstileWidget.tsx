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

      const attemptRender = () => {
        if (window.turnstile && containerRef.current && !widgetIdRef.current) {
          renderWidget();
        }
      };

      if (window.turnstile) {
        setTimeout(attemptRender, 50);
        return;
      }

      const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
      if (existingScript) {
        const checkInterval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(checkInterval);
            attemptRender();
          }
        }, 100);
        
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          if (!widgetIdRef.current) {
            setHasError(true);
            setIsLoading(false);
          }
        }, 10000);
        
        return () => {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.remove(widgetIdRef.current);
            } catch (e) {}
            widgetIdRef.current = null;
          }
        };
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      
      script.onload = () => {
        setTimeout(attemptRender, 100);
      };

      script.onerror = () => {
        setHasError(true);
        setIsLoading(false);
      };

      document.head.appendChild(script);

      return () => {
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
            <Skeleton className="w-[300px] h-[65px] rounded" />
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
