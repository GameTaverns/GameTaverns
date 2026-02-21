import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

const RECAPTCHA_SITE_KEY = "6LdkyXEsAAAAAK1Z9CISXvqloXriS6kGA1L4BqrY";

interface RecaptchaWidgetProps {
  action?: string;
  onVerify: (token: string) => void;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let scriptLoaded = false;
let scriptFailed = false;
let scriptLoadPromise: Promise<void> | null = null;

const LOAD_TIMEOUT_MS = 1500;

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptLoaded && window.grecaptcha) return Promise.resolve();
  if (scriptFailed) return Promise.reject(new Error("reCAPTCHA previously failed"));
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      scriptFailed = true;
      reject(new Error("reCAPTCHA load timed out"));
    }, LOAD_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src*="recaptcha/api.js"]`
    );
    if (existing) {
      const wait = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(wait);
          clearTimeout(timeout);
          scriptLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const wait = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(wait);
          clearTimeout(timeout);
          scriptLoaded = true;
          resolve();
        }
      }, 100);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      scriptFailed = true;
      reject(new Error("Failed to load reCAPTCHA script"));
    };
    document.head.appendChild(script);
  }).finally(() => {
    if (!window.grecaptcha) scriptLoadPromise = null;
  });

  return scriptLoadPromise;
}

/**
 * Invisible reCAPTCHA v3 — executes silently and calls onVerify with a token.
 * Native apps bypass entirely (token = "RECAPTCHA_BYPASS_TOKEN").
 * 
 * When reCAPTCHA is blocked (e.g. Brave browser), the token will be set to
 * "HONEYPOT_ONLY" — meaning the honeypot field is the sole bot check.
 * The server should accept this token when the honeypot passes.
 */
export function RecaptchaWidget({ action = "submit", onVerify }: RecaptchaWidgetProps) {
  const isNative = Capacitor.isNativePlatform();
  const hasVerified = useRef(false);

  const execute = useCallback(async () => {
    if (hasVerified.current) return;

    // Native bypass
    if (isNative) {
      hasVerified.current = true;
      onVerify("RECAPTCHA_BYPASS_TOKEN");
      return;
    }

    try {
      await loadRecaptchaScript();
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action });
          hasVerified.current = true;
          onVerify(token);
        } catch (err) {
          console.error("[RecaptchaWidget] execute error:", err);
          // reCAPTCHA failed to execute — fall back to honeypot-only mode
          hasVerified.current = true;
          onVerify("HONEYPOT_ONLY");
        }
      });
    } catch (err) {
      console.error("[RecaptchaWidget] load error:", err);
      // reCAPTCHA blocked (e.g. Brave) — fall back to honeypot-only mode
      hasVerified.current = true;
      onVerify("HONEYPOT_ONLY");
    }
  }, [action, isNative, onVerify]);

  useEffect(() => {
    execute();
  }, [execute]);

  // Invisible — renders nothing visible
  return null;
}
