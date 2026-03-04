# Self-Hosted Security Audit — GameTaverns
**Date:** 2026-03-04  
**Scope:** Edge functions, CORS, PII exposure, API keys, RLS, authentication

---

## 🔴 CRITICAL Findings

### 1. CORS Wildcard on 61+ Edge Functions
**Risk:** Any origin can make authenticated requests to your API  
**Details:** Only 3 of 64 edge functions use the shared `_shared/cors.ts` dynamic CORS utility. The rest hardcode `Access-Control-Allow-Origin: *`.  
**Mitigated by:** Self-hosted `main` router handles most requests and uses dynamic CORS. Direct function invocation on Lovable Cloud uses wildcard but is lower risk.  
**Fix:** For self-hosted, ensure ALL functions are routed through the `main` router. For standalone functions (rate-game, send-message), migrate to use `getCorsHeaders(req)` from `_shared/cors.ts`.

### 2. `dispatch_push_notification` DB Function — Hardcoded Cloud Key
**Risk:** If GUC settings fail, push notifications fall back to Lovable Cloud URL/key instead of self-hosted  
**Details:** The function in `public.dispatch_push_notification()` contains hardcoded Lovable Cloud anon key as fallback.  
**Fix:** Remove the hardcoded fallbacks. If GUC settings aren't available, the function should fail silently rather than leaking to wrong infrastructure.

---

## 🟡 MODERATE Findings

### 3. `rate-game` Function — No Authentication Required
**Risk:** Anonymous users can rate-bomb games  
**Details:** Uses `service_role_key` directly, bypassing all RLS. Rate limiting (50/hour/IP) provides some protection.  
**Mitigated by:** IP hashing, fingerprint checking, and rate limiting  
**Recommendation:** Consider adding Turnstile/CAPTCHA verification for anonymous ratings.

### 4. Password Minimum Length is 6 Characters
**Risk:** Weak passwords  
**Details:** `src/pages/Settings.tsx` enforces `minLength: 6`. Industry standard is 8+.  
**Fix:** Update to minimum 8 characters across all password fields (Settings, Signup, Admin user creation).

### 5. Anon Key Hardcoded in `src/config/runtime.ts`
**Risk:** Low — anon keys are publishable by design  
**Details:** The self-hosted anon key is embedded in source for native mobile builds.  
**Note:** This is architecturally necessary for Capacitor builds and is acceptable per Supabase security model. The anon key only provides access constrained by RLS policies.

---

## 🟢 GOOD Practices Found

- ✅ PII encryption for game messages (sender_email, sender_name, sender_ip)
- ✅ TOTP/2FA for admin access with mandatory re-auth on admin subdomain
- ✅ Account lockout after 5 failed attempts (15-minute window)
- ✅ Admin email allowlist restricts registration
- ✅ `SECURITY DEFINER` functions for role checks prevent RLS recursion
- ✅ IP hashing (SHA-256) for anonymous ratings preserves privacy
- ✅ Domain-restricted admin login gate (@gametaverns.com)
- ✅ Runtime config injection prevents credential leakage in self-hosted builds
- ✅ Password reset tokens with expiration
- ✅ Webhook agent for automated deployments

---

## 📋 Recommended Actions (Priority Order)

1. **Remove hardcoded Cloud fallback from `dispatch_push_notification`** — Run SQL:
   ```sql
   -- Update the function to remove hardcoded fallbacks
   -- Only use GUC settings, fail silently if unavailable
   ```

2. **Increase password minimum to 8 characters** — Update all password validation

3. **Add Turnstile to `rate-game` endpoint** — Prevent anonymous abuse

4. **Audit `CORS_ORIGINS` env var on self-hosted** — Ensure it's set to your domains

5. **Enable `Strict-Transport-Security` header** on nginx (if not already set)

---

## Nginx Bot Detection for OG Tags

Add this to your self-hosted nginx config to serve OG meta tags to social media crawlers:

```nginx
# Detect social media bots for OG tag serving
map $http_user_agent $is_social_bot {
    default 0;
    ~*facebookexternalhit 1;
    ~*Twitterbot 1;
    ~*LinkedInBot 1;
    ~*Slackbot 1;
    ~*Discordbot 1;
    ~*WhatsApp 1;
    ~*TelegramBot 1;
}

# In your server block, before the SPA catch-all:
location ~ ^/game/ {
    if ($is_social_bot) {
        # Extract slug from subdomain, proxy to og-meta function
        rewrite ^(.*)$ /functions/v1/og-meta?slug=$tenant_slug&path=$1 break;
        proxy_pass http://kong:8000;
    }
    try_files $uri /index.html;
}
```
