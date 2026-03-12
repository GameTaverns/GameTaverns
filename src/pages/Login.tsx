import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo.png";
import tavernBg from "@/assets/tavern-bg.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TotpVerify } from "@/components/auth/TotpVerify";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import { RecaptchaWidget } from "@/components/games/RecaptchaWidget";
import { Capacitor } from "@capacitor/core";
import { Sparkles } from "lucide-react";

const isNative = Capacitor.isNativePlatform();

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  const [authGate, setAuthGate] = useState<"idle" | "checking_2fa" | "needs_2fa">("idle");
  // reCAPTCHA v3 tokens — auto-populated invisibly on mount; native gets bypass token
  // Tokens default to "pending" on web so the button is never disabled waiting for reCAPTCHA
  const [signinTurnstileToken, setSigninTurnstileToken] = useState<string | null>(isNative ? "bypass" : "pending");
  const [signupTurnstileToken, setSignupTurnstileToken] = useState<string | null>(isNative ? "bypass" : "pending");
  // Honeypot fields — bots fill these, humans never see them
  const [signinHoneypot, setSigninHoneypot] = useState("");
  const [signupHoneypot, setSignupHoneypot] = useState("");
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [referralCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ref") || undefined;
  });
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  useEffect(() => {
    if (!loading && isAuthenticated && !hasCheckedAuth && !isLoading && !requires2FA && authGate === "idle") {
      setHasCheckedAuth(true);
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate, hasCheckedAuth, isLoading, requires2FA, authGate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot check — if filled, silently reject (it's a bot)
    if (signinHoneypot) {
      toast({ title: t('errors.verificationFailed'), variant: "destructive" });
      return;
    }
    // If reCAPTCHA hasn't resolved yet (blocked by browser), treat as honeypot-only
    const effectiveSigninToken = (!signinTurnstileToken || signinTurnstileToken === "pending") ? "HONEYPOT_ONLY" : signinTurnstileToken;
    setIsLoading(true);
    setAuthGate("checking_2fa");
    setHasCheckedAuth(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: t('errors.error'),
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        setHasCheckedAuth(false);
        setAuthGate("idle");
        if (!isNative) {
          setSigninTurnstileToken("pending");
        }
        return;
      }

      // On native, skip the TOTP check entirely — the extra network round-trip
      // causes the WebView to hang for up to 4 seconds, making it feel "stuck".
      if (!isNative) {
        // Check if user has 2FA enabled (web only)
        // Wait for the auth state to settle — signIn resolves before onAuthStateChange fires
        let session = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 200));
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            session = data.session;
            break;
          }
        }
        console.log("[Login] 2FA check — session available:", !!session?.access_token, "after retries");
        
        if (session?.access_token) {
          try {
            const controller = new AbortController();
            const totpTimeout = setTimeout(() => controller.abort(), 8000);
            
            console.log("[Login] Calling totp-status at:", `${apiUrl}/functions/v1/totp-status`);
            const response = await fetch(`${apiUrl}/functions/v1/totp-status`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: anonKey,
              },
              signal: controller.signal,
            }).catch((err) => {
              console.error("[Login] totp-status fetch failed:", err.name, err.message);
              return null;
            });
            
            clearTimeout(totpTimeout);
            console.log("[Login] totp-status response status:", response?.status);
            
            if (response?.ok) {
              const data = await response.json().catch(() => ({}));
              console.log("[Login] totp-status data:", JSON.stringify(data));
              
              if (data.isEnabled && data.requiresVerification !== false) {
                console.log("[Login] 2FA REQUIRED — showing TOTP verify screen");
                setPendingAccessToken(session.access_token);
                setRequires2FA(true);
                setAuthGate("needs_2fa");
                setIsLoading(false);
                return;
              } else {
                console.log("[Login] 2FA not required — isEnabled:", data.isEnabled, "requiresVerification:", data.requiresVerification);
              }
            } else if (response) {
              const errorBody = await response.text().catch(() => "");
              console.error("[Login] totp-status error response:", response.status, errorBody);
            } else {
              console.error("[Login] totp-status returned null (fetch failed)");
            }
          } catch (e: any) {
            console.error("[Login] 2FA check exception:", e.name, e.message);
            // Timed out or failed — proceed to dashboard
          }
        } else {
          console.warn("[Login] No session available after retries — skipping 2FA check");
        }
      }

      toast({ title: t('login.welcomeBackToast') });
      setIsLoading(false);
      setAuthGate("idle");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      console.error("[Login] Unexpected error during sign in:", e);
      setIsLoading(false);
      setAuthGate("idle");
    }
  };

  const handle2FASuccess = () => {
    setRequires2FA(false);
    setPendingAccessToken(null);
    setAuthGate("idle");
    toast({ title: t('login.welcomeBackToast') });
    navigate("/dashboard", { replace: true });
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setRequires2FA(false);
    setPendingAccessToken(null);
    setAuthGate("idle");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot check
    if (signupHoneypot) {
      toast({ title: t('errors.verificationFailed'), variant: "destructive" });
      return;
    }
    // If reCAPTCHA hasn't resolved yet (blocked by browser), treat as honeypot-only
    const effectiveSignupToken = (!signupTurnstileToken || signupTurnstileToken === "pending") ? "HONEYPOT_ONLY" : signupTurnstileToken;

    if (password !== signupConfirmPassword) {
      toast({
        title: t('errors.passwordsDontMatch'),
        description: t('errors.passwordsDontMatchDesc'),
        variant: "destructive",
      });
      return;
    }

    const { validatePassword } = await import("@/lib/password-validation");
    const validation = validatePassword(password);
    if (!validation.valid) {
      toast({
        title: t('errors.passwordTooShort'),
        description: validation.errors[0],
        variant: "destructive",
      });
      return;
    }

    if (signupUsername && (signupUsername.length < 3 || signupUsername.length > 30)) {
      toast({
        title: t('errors.invalidUsername'),
        description: t('errors.invalidUsernameLength'),
        variant: "destructive",
      });
      return;
    }

    if (signupUsername && !/^[a-zA-Z0-9_]+$/.test(signupUsername)) {
      toast({
        title: t('errors.invalidUsername'),
        description: t('errors.invalidUsernameChars'),
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await signUp(signupEmail, password, {
        username: signupUsername || undefined,
        displayName: signupDisplayName || signupEmail.split("@")[0],
        referralCode,
      });

      if (error) {
        toast({
          title: t('errors.error'),
          description: error.message,
          variant: "destructive",
        });
        if (!isNative) {
          setSignupTurnstileToken("pending");
        }
        return;
      }

      toast({
        title: t('signup.accountCreated'),
        description: t('signup.youCanSignIn'),
      });
      navigate("/login");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <img src={tavernBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-background/70 dark:bg-wood-dark/80 backdrop-blur-sm" />
        <div className="animate-pulse text-foreground relative z-10">{t('login.loading')}</div>
      </div>
    );
  }

  if (isAuthenticated && !requires2FA && authGate === "idle") {
    return null;
  }

  if (requires2FA && pendingAccessToken) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        <img src={tavernBg} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-background/70 dark:bg-wood-dark/80 backdrop-blur-sm" />
        <div className="relative z-10">
          <TotpVerify 
            accessToken={pendingAccessToken}
            onSuccess={handle2FASuccess}
            onCancel={handle2FACancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Tavern background with overlay */}
      <img 
        src={tavernBg} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover" 
        aria-hidden="true" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/60 to-background/40 dark:from-wood-dark/95 dark:via-wood-dark/70 dark:to-wood-dark/50" />
      
      {/* Warm candlelight vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, hsl(25 30% 8% / 0.4) 100%)',
        }}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        <LanguageSwitcher />
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

      {/* Main card */}
      <Card className="w-full max-w-md relative z-10 card-handcrafted bg-card/95 dark:bg-sidebar/95 border-gold/20 backdrop-blur-md shadow-[0_8px_32px_-8px_hsl(25_30%_8%/0.5)]">
        <CardHeader className="text-center pb-4">
          <Link to="/" className="flex items-center justify-center gap-3 mb-3 group">
            <img 
              src={logoImage} 
              alt="GameTaverns" 
              className="h-18 w-auto drop-shadow-[0_2px_8px_hsl(28_50%_48%/0.3)] transition-transform group-hover:scale-105" 
            />
            <span className="font-display text-3xl font-bold text-foreground drop-shadow-[0_1px_2px_hsl(0_0%_0%/0.1)]">
              GameTaverns
            </span>
          </Link>
          <div className="section-divider mb-4" />
          <CardTitle className="font-display text-2xl text-foreground">{t('login.welcomeBack')}</CardTitle>
          <CardDescription className="text-muted-foreground font-accent italic">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/80 dark:bg-wood-medium/50 border border-border/30">
              <TabsTrigger 
                value="signin" 
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground font-display"
              >
                {t('login.signIn')}
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground font-display"
              >
                {t('login.signUp')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-foreground/80 font-accent">{t('login.email')}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                    required
                  />
                </div>
                {/* Honeypot — invisible to humans, bots auto-fill it */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
                  <input
                    type="text"
                    name="website_url"
                    tabIndex={-1}
                    autoComplete="off"
                    value={signinHoneypot}
                    onChange={(e) => setSigninHoneypot(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-foreground/80 font-accent">{t('login.password')}</Label>
                  <PasswordInput
                    id="signin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                    required
                  />
                </div>
                {!isNative && (
                  <RecaptchaWidget
                    action="signin"
                    onVerify={setSigninTurnstileToken}
                  />
                )}
                <Button 
                  type="submit" 
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display shadow-[0_2px_8px_-2px_hsl(28_50%_48%/0.4)] transition-all hover:shadow-[0_4px_12px_-2px_hsl(28_50%_48%/0.5)] hover:-translate-y-0.5" 
                  disabled={isLoading}
                >
                  {isLoading ? t('login.signingIn') : t('login.signIn')}
                </Button>
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-secondary hover:text-secondary/80 underline font-accent"
                  >
                    {t('login.forgotPassword')}
                  </Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-foreground/80 font-accent">
                    {t('login.username')} <span className="text-muted-foreground text-xs">{t('login.usernameOptional')}</span>
                  </Label>
                  <Input
                    id="signup-username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder={t('login.usernamePlaceholder')}
                    maxLength={30}
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                  />
                  <p className="text-xs text-muted-foreground">{t('login.usernameHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-displayname" className="text-foreground/80 font-accent">
                    {t('login.displayName')} <span className="text-muted-foreground text-xs">{t('login.displayNameOptional')}</span>
                  </Label>
                  <Input
                    id="signup-displayname"
                    value={signupDisplayName}
                    onChange={(e) => setSignupDisplayName(e.target.value)}
                    placeholder={t('login.displayNamePlaceholder')}
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-foreground/80 font-accent">{t('login.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder')}
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground/80 font-accent">{t('login.password')}</Label>
                  <PasswordInput
                    id="signup-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password" className="text-foreground/80 font-accent">{t('login.confirmPassword')}</Label>
                  <PasswordInput
                    id="signup-confirm-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input/80 border-border/50 text-foreground placeholder:text-muted-foreground backdrop-blur-sm"
                    minLength={6}
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
                    value={signupHoneypot}
                    onChange={(e) => setSignupHoneypot(e.target.value)}
                  />
                </div>
                {!isNative && (
                  <RecaptchaWidget
                    action="signup"
                    onVerify={setSignupTurnstileToken}
                  />
                )}
                <Button 
                  type="submit" 
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display shadow-[0_2px_8px_-2px_hsl(28_50%_48%/0.4)] transition-all hover:shadow-[0_4px_12px_-2px_hsl(28_50%_48%/0.5)] hover:-translate-y-0.5" 
                  disabled={isLoading}
                >
                  {isLoading ? t('login.creatingAccount') : t('login.createAccount')}
                </Button>
                <p className="text-xs text-muted-foreground text-center font-accent">
                  {t('signup.youCanSignIn')}
                </p>
              </form>
            </TabsContent>
          </Tabs>
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
};

export default Login;
