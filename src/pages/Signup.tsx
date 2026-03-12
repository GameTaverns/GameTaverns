import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RecaptchaWidget } from "@/components/games/RecaptchaWidget";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo.png";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { useToast } from "@/hooks/use-toast";
import { apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { useTranslation } from "react-i18next";
import { validatePassword, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-validation";
// IMPORTANT: we do NOT call supabase.auth.signUp() here. We use a backend function
// that creates the user directly (email confirmation is disabled on self-hosted).

export default function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const isNative = Capacitor.isNativePlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(isNative ? "bypass" : null);
  const [honeypot, setHoneypot] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (honeypot) {
      toast({ title: t('errors.verificationFailed'), variant: "destructive" });
      return;
    }
    
    if (!isNative && !turnstileToken) {
      toast({ title: t('signup.pleaseCompleteVerification'), variant: "destructive" });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: t('errors.passwordsDontMatch'),
        description: t('errors.passwordsDontMatchDesc'),
        variant: "destructive",
      });
      return;
    }
    
    const validation = validatePassword(password);
    if (!validation.valid) {
      toast({
        title: t('errors.passwordTooShort'),
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }
    
    
    setIsLoading(true);
    
    try {
      // Self-hosted mode: call local API
      if (isSelfHostedMode()) {
        const response = await apiClient.post<{ 
          message?: string; 
          requiresVerification?: boolean;
          user?: { id: string; email: string };
          token?: string;
        }>("/auth/register", {
          email,
          password,
          displayName: email.split("@")[0],
        });

        if (response.requiresVerification) {
          // Self-hosted: email confirmation is disabled, just redirect to login
          toast({
            title: t('signup.accountCreated'),
            description: t('signup.youCanSignIn'),
          });
          navigate("/login");
        } else if (response.token) {
          localStorage.setItem("auth_token", response.token);
          toast({
            title: t('signup.accountCreated'),
            description: t('signup.welcomeToGameTaverns'),
          });
          navigate("/dashboard");
        } else {
          toast({
            title: t('signup.accountCreated'),
            description: t('signup.youCanSignIn'),
          });
          navigate("/login");
        }
        return;
      }

      // Cloud mode: call Supabase Edge Function
      const isNative = Capacitor.isNativePlatform();
      const nativeHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (isNative) {
        nativeHeaders["x-native-app-token"] = import.meta.env.VITE_NATIVE_APP_SECRET || "";
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup`,
        {
          method: "POST",
          headers: nativeHeaders,
          body: JSON.stringify({
            email,
            password,
            displayName: email.split("@")[0],
            redirectUrl: window.location.origin,
            recaptcha_token: turnstileToken,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || t('signup.signupFailed'));
      }

      toast({
        title: t('signup.accountCreated'),
        description: t('signup.youCanSignIn'),
      });
      
      navigate("/login");
    } catch (error: any) {
      toast({
        title: t('signup.signupFailed'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Tavern background with overlay */}
      <img src={tavernBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/60 to-background/40 dark:from-wood-dark/95 dark:via-wood-dark/70 dark:to-wood-dark/50" />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, hsl(25 30% 8% / 0.4) 100%)' }}
      />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Decorative top ornament */}
      <div className="relative z-10 mb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/40" />
          <Sparkles className="h-4 w-4 text-gold/50" />
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
      </div>

      <Card className="w-full max-w-md relative z-10 card-handcrafted bg-card/95 dark:bg-sidebar/95 border-gold/20 backdrop-blur-md shadow-[0_8px_32px_-8px_hsl(25_30%_8%/0.5)]">
        <CardHeader className="text-center pb-4">
          <Link to="/" className="flex items-center justify-center gap-3 mb-3 group">
            <img src={logoImage} alt="GameTaverns" className="h-18 w-auto drop-shadow-[0_2px_8px_hsl(28_50%_48%/0.3)] transition-transform group-hover:scale-105" />
            <span className="font-display text-3xl font-bold text-foreground drop-shadow-[0_1px_2px_hsl(0_0%_0%/0.1)]">GameTaverns</span>
          </Link>
          <div className="section-divider mb-4" />
          <CardTitle className="font-display text-2xl text-foreground">{t('signup.createAccount')}</CardTitle>
          <CardDescription className="text-muted-foreground font-accent italic">
            {t('signup.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground/80 font-accent">
                {t('signup.usernameLabel')} <span className="text-muted-foreground">{t('signup.usernameOptional')}</span>
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder={t('signup.usernamePlaceholder')}
                maxLength={30}
                className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
              />
              <p className="text-xs text-muted-foreground">{t('signup.usernameHint')}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-foreground/80 font-accent">
                {t('signup.displayNameLabel')} <span className="text-muted-foreground">{t('signup.displayNameOptional')}</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('signup.displayNamePlaceholder')}
                className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80 font-accent">{t('signup.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('signup.emailPlaceholder')}
                className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80 font-accent">{t('signup.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('signup.passwordPlaceholder')}
                className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                required
              />
              <PasswordStrengthIndicator password={password} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground/80 font-accent">{t('signup.confirmPasswordLabel')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('signup.passwordPlaceholder')}
                className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                required
              />
            </div>
            {/* Honeypot — invisible to humans, bots auto-fill it */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
              <input
                type="text"
                name="company_name"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {!isNative && (
              <RecaptchaWidget
                action="signup"
                onVerify={setTurnstileToken}
              />
            )}

            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display shadow-[0_2px_8px_-2px_hsl(28_50%_48%/0.4)] transition-all hover:shadow-[0_4px_12px_-2px_hsl(28_50%_48%/0.5)] hover:-translate-y-0.5"
              disabled={isLoading || (!isNative && !turnstileToken)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('signup.creatingAccount')}
                </>
              ) : (
                t('signup.createAccount')
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <div className="section-divider mb-4" />
            <p className="text-muted-foreground font-accent">
              {t('signup.alreadyHaveAccount')}{" "}
              <Link to="/login" className="text-secondary hover:text-secondary/80 underline">
                {t('signup.signIn')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bottom decorative ornament */}
      <div className="relative z-10 mt-6 flex items-center gap-3 text-muted-foreground/40">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/30" />
        <span className="text-xs font-accent italic">Est. 2025</span>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/30" />
      </div>
    </div>
  );
}