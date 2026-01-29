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

const Login = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    if (!loading && isAuthenticated && !hasCheckedAuth) {
      setHasCheckedAuth(true);
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate, hasCheckedAuth]);

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

    try {
      const { error } = await signIn(emailOrUsername, password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        resetTurnstile();
        return;
      }

      toast({ title: "Welcome back!" });
      navigate("/dashboard", { replace: true });
    } finally {
      setIsLoading(false);
    }
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
    
    setIsLoading(true);

    try {
      const { error } = await signUp(signupEmail, password);

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
      <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center">
        <div className="animate-pulse text-cream">Loading...</div>
      </div>
    );
  }

  // Already authenticated, will redirect
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center p-4">
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