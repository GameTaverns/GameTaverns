import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

const ALLOWED_DOMAIN = "gametaverns.com";

function validateStudioEmail(email: string): boolean {
  const parts = email.split("@");
  return parts.length === 2 && parts[1].toLowerCase() === ALLOWED_DOMAIN;
}

export default function StudioLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/studio", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStudioEmail(email)) {
      toast({ title: "Access Denied", description: "Only @gametaverns.com emails are allowed.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Welcome to Studio!" });
      navigate("/studio", { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStudioEmail(email)) {
      toast({ title: "Access Denied", description: "Only @gametaverns.com emails are allowed.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, {
        displayName: displayName || email.split("@")[0],
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Check your email!", description: "We've sent you a confirmation link." });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md bg-card/80 dark:bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-12 w-auto" />
            <div className="text-left">
              <span className="font-display text-xl font-bold text-foreground block">GameTaverns</span>
              <span className="text-xs font-medium text-secondary flex items-center gap-1">
                <Shield className="h-3 w-3" /> Studio
              </span>
            </div>
          </div>
          <CardTitle className="font-display text-2xl text-foreground">Studio Access</CardTitle>
          <CardDescription className="text-muted-foreground">
            Internal portal — @gametaverns.com accounts only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted dark:bg-wood-medium/50">
              <TabsTrigger value="signin" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="studio-email" className="text-foreground/80">Email</Label>
                  <Input
                    id="studio-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gametaverns.com"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studio-password" className="text-foreground/80">Password</Label>
                  <PasswordInput
                    id="studio-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="studio-signup-name" className="text-foreground/80">Display Name</Label>
                  <Input
                    id="studio-signup-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studio-signup-email" className="text-foreground/80">Email</Label>
                  <Input
                    id="studio-signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gametaverns.com"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Only @gametaverns.com emails are accepted</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studio-signup-password" className="text-foreground/80">Password</Label>
                  <PasswordInput
                    id="studio-signup-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studio-signup-confirm" className="text-foreground/80">Confirm Password</Label>
                  <PasswordInput
                    id="studio-signup-confirm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Register"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
