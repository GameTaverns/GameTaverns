import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Prevent redirect loops from stale/expired sessions being hydrated from storage.
    // The auth listener can briefly set isAuthenticated=true before clearing an
    // invalid session, causing /admin -> /settings -> /admin flicker.
    // We debounce AND verify the session is still valid before navigating.
    if (!loading && isAuthenticated) {
      let cancelled = false;
      const timer = window.setTimeout(async () => {
        if (cancelled) return;
        
        // Re-check: verify with the SDK that the session is actually valid.
        // This catches cases where hydration succeeded but the token is invalid.
        try {
          const { supabase } = await import("@/integrations/backend/client");
          const { data, error } = await supabase.auth.getSession();
          
          if (cancelled) return;
          
          // If there's an error or no valid session, clear storage and stay on login
          if (error || !data?.session?.user) {
            // Clear any stale tokens that caused the false positive
            const keys = Object.keys(localStorage).filter(
              k => k.startsWith("sb-") && k.endsWith("-auth-token")
            );
            keys.forEach(k => {
              try { localStorage.removeItem(k); } catch { /* ignore */ }
            });
            return;
          }
          
          // Double-check: make a simple API call to verify the token works
          const { error: testError } = await supabase
            .from("site_settings_public")
            .select("key")
            .limit(1);
          
          if (cancelled) return;
          
          // Only navigate if the token is actually working
          if (!testError) {
            navigate("/settings", { replace: true });
          }
        } catch {
          // Session check failed; stay on login page.
        }
      }, 500); // Increased debounce to allow auth state to settle
      
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Welcome back!" });
      // Navigation happens via the useEffect once auth state is fully updated.
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signUp(email, password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Account created!",
        description: "You can now sign in.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!loading && isAuthenticated) return null;

  return (
    <div className="min-h-screen parchment-texture flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-elevated">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <span className="font-display text-xl font-semibold">Sommerfeld Game Library</span>
          </Link>
          <CardTitle className="font-display text-2xl">Admin Access</CardTitle>
          <CardDescription>
            Sign in to manage your game collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <PasswordInput
                    id="signin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
