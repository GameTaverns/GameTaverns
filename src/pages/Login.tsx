import { useEffect, useState, useCallback } from "react";
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
import { TurnstileWidget } from "@/components/games/TurnstileWidget";
import { TotpVerify } from "@/components/auth/TotpVerify";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  const [authGate, setAuthGate] = useState<"idle" | "checking_2fa" | "needs_2fa">("idle");
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    // Only redirect once auth loading is complete and user is authenticated
    // IMPORTANT: During an active sign-in attempt we intentionally suppress
    // this auto-redirect so we can run the mandatory 2FA status check first.
    // Also skip if 2FA verification is pending.
    if (!loading && isAuthenticated && !hasCheckedAuth && !isLoading && !requires2FA && authGate === "idle") {
      setHasCheckedAuth(true);
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate, hasCheckedAuth, isLoading, requires2FA, authGate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({
        title: "Verification required",
        description: "Please complete the verification challenge",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setAuthGate("checking_2fa");
    // Prevent the auth-change useEffect above from redirecting to /dashboard
    // before we can run the 2FA gate checks.
    setHasCheckedAuth(true);

    try {
      const { error } = await signIn(emailOrUsername, password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        setHasCheckedAuth(false);
        resetTurnstile();
        return;
      }

      // Check if user has 2FA enabled
      // Wait a moment for session to be fully established
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[Login] Checking 2FA status, session exists:", !!session, "has access_token:", !!session?.access_token);
      
      if (session?.access_token) {
        try {
          console.log("[Login] Calling totp-status at:", `${apiUrl}/functions/v1/totp-status`);
          const response = await fetch(`${apiUrl}/functions/v1/totp-status`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: anonKey,
            },
          });

          console.log("[Login] totp-status response status:", response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log("[Login] totp-status data:", JSON.stringify(data));
            
            if (data.isEnabled) {
              // Check if within grace period - skip 2FA if recently verified
              if (data.requiresVerification === false) {
                console.log("[Login] 2FA enabled but within grace period, skipping verification");
                // Continue to dashboard without 2FA prompt
              } else {
                // User has 2FA enabled and needs to verify
                console.log("[Login] 2FA is enabled, showing verification screen");
                setPendingAccessToken(session.access_token);
                setRequires2FA(true);
                setAuthGate("needs_2fa");
                setIsLoading(false);
                return;
              }
            } else if (data.requiresSetup) {
              // User needs to set up 2FA (required for all users)
              console.log("[Login] 2FA requires setup, redirecting to /setup-2fa");
              setIsLoading(false);
              setAuthGate("idle");
              navigate("/setup-2fa", { replace: true });
              return;
            } else {
              console.log("[Login] 2FA not enabled and not required, proceeding to dashboard");
            }
          } else {
            const errorText = await response.text();
            console.error("[Login] totp-status failed:", response.status, errorText);
          }
        } catch (e) {
          console.error("[Login] Failed to check 2FA status:", e);
          // Continue to dashboard if 2FA check fails
        }
      } else {
        console.warn("[Login] No session access_token available after sign in - this may indicate a session issue");
      }

      toast({ title: "Welcome back!" });
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
    toast({ title: "Welcome back!" });
    navigate("/dashboard", { replace: true });
  };

  const handle2FACancel = async () => {
    // Sign out and reset state
    await supabase.auth.signOut();
    setRequires2FA(false);
    setPendingAccessToken(null);
    setAuthGate("idle");
    resetTurnstile();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({
        title: "Verification required",
        description: "Please complete the verification challenge",
        variant: "destructive",
      });
      return;
    }

    if (password !== signupConfirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    // Validate username if provided
    if (signupUsername && (signupUsername.length < 3 || signupUsername.length > 30)) {
      toast({
        title: "Invalid username",
        description: "Username must be between 3 and 30 characters",
        variant: "destructive",
      });
      return;
    }

    if (signupUsername && !/^[a-zA-Z0-9_]+$/.test(signupUsername)) {
      toast({
        title: "Invalid username",
        description: "Username can only contain letters, numbers, and underscores",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const { error } = await signUp(signupEmail, password, {
        username: signupUsername.toLowerCase() || undefined,
        displayName: signupDisplayName || signupEmail.split("@")[0],
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        resetTurnstile();
        return;
      }

      toast({
        title: "Check your email!",
        description: "We've sent you a confirmation link.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show nothing while checking auth to prevent flash
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }

  // Already authenticated, will redirect
  // If we are authenticated but still checking/awaiting 2FA, don't blank the screen.
  if (isAuthenticated && !requires2FA && authGate === "idle") {
    return null;
  }

  // Show 2FA verification screen
  if (requires2FA && pendingAccessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center p-4">
        <TotpVerify 
          accessToken={pendingAccessToken}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
          </Link>
          <CardTitle className="font-display text-2xl text-cream">Welcome Back</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to manage your game libraries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full" onValueChange={resetTurnstile}>
            <TabsList className="grid w-full grid-cols-2 bg-wood-medium/50">
              <TabsTrigger 
                value="signin" 
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-cream/80">Email or Username</Label>
                  <Input
                    id="signin-email"
                    type="text"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder="you@example.com or username"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-cream/80">Password</Label>
                  <PasswordInput
                    id="signin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-cream/80">Verification</Label>
                  <TurnstileWidget
                    key={`signin-${turnstileKey}`}
                    onVerify={handleTurnstileVerify}
                    onExpire={handleTurnstileExpire}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display" 
                  disabled={isLoading || !turnstileToken}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-secondary hover:text-secondary/80 underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="text-cream/80">
                    Username <span className="text-muted-foreground text-xs">(optional, for login)</span>
                  </Label>
                  <Input
                    id="signup-username"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="your_username"
                    maxLength={30}
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, underscores only</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-displayname" className="text-cream/80">
                    Display Name <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="signup-displayname"
                    value={signupDisplayName}
                    onChange={(e) => setSignupDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-cream/80">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-cream/80">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password" className="text-cream/80">Confirm Password</Label>
                  <PasswordInput
                    id="signup-confirm-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-cream/80">Verification</Label>
                  <TurnstileWidget
                    key={`signup-${turnstileKey}`}
                    onVerify={handleTurnstileVerify}
                    onExpire={handleTurnstileExpire}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display" 
                  disabled={isLoading || !turnstileToken}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  You'll receive a confirmation email to verify your account
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