import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TotpVerify } from "@/components/auth/TotpVerify";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import logoImage from "@/assets/logo.png";

/**
 * Mobile V2 Login Screen
 * 
 * Clean, full-screen, mobile-optimized login.
 * No tavern background — just clean, fast, native-feeling.
 */
const MobileV2Login = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  useEffect(() => {
    if (!loading && isAuthenticated && !hasCheckedAuth && !isLoading && !requires2FA) {
      setHasCheckedAuth(true);
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate, hasCheckedAuth, isLoading, requires2FA]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setHasCheckedAuth(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: t('errors.error'), description: error.message, variant: "destructive" });
        return;
      }

      // Check 2FA
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch(`${apiUrl}/functions/v1/totp-status`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': anonKey,
            },
          });
          if (response.ok) {
            const totpData = await response.json();
            if (totpData.isEnabled && !totpData.isVerified) {
              setRequires2FA(true);
              setPendingAccessToken(session.access_token);
              return;
            }
          }
        }
      } catch {
        // 2FA check failed — proceed without
      }

      navigate("/dashboard", { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t('errors.error'), description: t('signup.passwordMismatch', 'Passwords do not match'), variant: "destructive" });
      return;
    }

    const { validatePassword } = await import("@/lib/password-validation");
    const validation = validatePassword(password);
    if (!validation.valid) {
      toast({ title: t('errors.passwordTooShort'), description: validation.errors[0], variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, {
        displayName: email.split("@")[0],
      });
      if (error) {
        toast({ title: t('errors.error'), description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: t('signup.accountCreated') });
      setMode("signin");
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASuccess = () => {
    setRequires2FA(false);
    setPendingAccessToken(null);
    navigate("/dashboard", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('login.loading')}</div>
      </div>
    );
  }

  if (isAuthenticated && !requires2FA) return null;

  if (requires2FA && pendingAccessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <TotpVerify
          accessToken={pendingAccessToken}
          onSuccess={handle2FASuccess}
          onCancel={() => { setRequires2FA(false); setPendingAccessToken(null); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Logo section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <img src={logoImage} alt="GameTaverns" className="h-16 w-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-foreground">GameTaverns</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('mobileLogin.tagline', 'Your game night companion')}
        </p>
      </div>

      {/* Form section */}
      <div className="px-6 pb-8 space-y-5">
        {/* Mode toggle */}
        <div className="flex bg-muted rounded-lg p-1">
          <button
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              mode === "signin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            onClick={() => setMode("signin")}
          >
            {t('login.signIn')}
          </button>
          <button
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            onClick={() => setMode("signup")}
          >
            {t('login.signUp')}
          </button>
        </div>

        <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">{t('login.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 text-base"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">{t('login.password')}</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 text-base"
              required
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm">{t('login.confirmPassword')}</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 text-base"
                required
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={isLoading}
          >
            {isLoading
              ? (mode === "signin" ? t('login.signingIn') : t('login.creatingAccount'))
              : (mode === "signin" ? t('login.signIn') : t('login.createAccount'))
            }
          </Button>

          {mode === "signin" && (
            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                {t('login.forgotPassword')}
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default MobileV2Login;
