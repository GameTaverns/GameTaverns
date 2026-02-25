import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo.png";
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

const isNative = Capacitor.isNativePlatform();

const Login = () => {
  const { t } = useTranslation();
  const [emailOrUsername, setEmailOrUsername] = useState("");
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
      const { error } = await signIn(emailOrUsername, password);

      if (error) {
        toast({
          title: t('errors.error'),
          description: error.message,
          variant: "destructive",
        });
        setHasCheckedAuth(false);
        if (!isNative) {
          setSigninTurnstileToken("pending");
        }
        return;
      }

      // On native, skip the TOTP check entirely — the extra network round-trip
      // causes the WebView to hang for up to 4 seconds, making it feel "stuck".
      if (!isNative) {
        // Check if user has 2FA enabled (web only)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          try {
            const controller = new AbortController();
            const totpTimeout = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(`${apiUrl}/functions/v1/totp-status`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: anonKey,
              },
              signal: controller.signal,
            }).catch(() => null);
            
            clearTimeout(totpTimeout);
            
            if (response?.ok) {
              const data = await response.json().catch(() => ({}));
              
              if (data.isEnabled && data.requiresVerification !== false) {
                setPendingAccessToken(session.access_token);
                setRequires2FA(true);
                setAuthGate("needs_2fa");
                setIsLoading(false);
                return;
              }
            }
          } catch (e) {
            // Timed out or failed — proceed to dashboard
          }
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

    if (password.length < 6) {
      toast({
        title: t('errors.passwordTooShort'),
        description: t('errors.passwordTooShortDesc'),
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
        username: signupUsername.toLowerCase() || undefined,
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
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-foreground">{t('login.loading')}</div>
      </div>
    );
  }

  if (isAuthenticated && !requires2FA && authGate === "idle") {
    return null;
  }

  if (requires2FA && pendingAccessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center p-4">
        <TotpVerify 
          accessToken={pendingAccessToken}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md bg-card/80 dark:bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
            <span className="font-display text-2xl font-bold text-foreground">GameTaverns</span>
          </Link>
          <CardTitle className="font-display text-2xl text-foreground">{t('login.welcomeBack')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted dark:bg-wood-medium/50">
              <TabsTrigger 
                value="signin" 
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                {t('login.signIn')}
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                {t('login.signUp')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-foreground/80">{t('login.emailOrUsername')}</Label>
                  <Input
                    id="signin-email"
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder={t('login.emailOrUsernamePlaceholder')}
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
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
                  <Label htmlFor="signin-password" className="text-foreground/80">{t('login.password')}</Label>
                  <PasswordInput
                    id="signin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
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
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display" 
                  disabled={isLoading}
                >
                  {isLoading ? t('login.signingIn') : t('login.signIn')}
                </Button>
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-secondary hover:text-secondary/80 underline"
                  >
                    {t('login.forgotPassword')}
                  </Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-foreground/80">
                    {t('login.username')} <span className="text-muted-foreground text-xs">{t('login.usernameOptional')}</span>
                  </Label>
                  <Input
                    id="signup-username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder={t('login.usernamePlaceholder')}
                    maxLength={30}
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">{t('login.usernameHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-displayname" className="text-foreground/80">
                    {t('login.displayName')} <span className="text-muted-foreground text-xs">{t('login.displayNameOptional')}</span>
                  </Label>
                  <Input
                    id="signup-displayname"
                    value={signupDisplayName}
                    onChange={(e) => setSignupDisplayName(e.target.value)}
                    placeholder={t('login.displayNamePlaceholder')}
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-foreground/80">{t('login.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder')}
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground/80">{t('login.password')}</Label>
                  <PasswordInput
                    id="signup-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password" className="text-foreground/80">{t('login.confirmPassword')}</Label>
                  <PasswordInput
                    id="signup-confirm-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
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
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display" 
                  disabled={isLoading}
                >
                  {isLoading ? t('login.creatingAccount') : t('login.createAccount')}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {t('signup.youCanSignIn')}
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
