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
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

const ALLOWED_DOMAIN = "gametaverns.com";

function validateAdminEmail(email: string): boolean {
  const parts = email.split("@");
  return parts.length === 2 && parts[1].toLowerCase() === ALLOWED_DOMAIN;
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, isAuthenticated, loading, user, isAdmin, isStaff, roleLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !roleLoading && isAuthenticated && user?.email) {
      if (validateAdminEmail(user.email) && (isAdmin || isStaff)) {
        navigate("/", { replace: true });
      }
    }
  }, [isAuthenticated, loading, roleLoading, navigate, user, isAdmin, isStaff]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAdminEmail(email)) {
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
      // Navigation will be handled by the useEffect above once auth state updates
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || roleLoading) {
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
              <span className="text-xs font-medium text-destructive flex items-center gap-1">
                <Shield className="h-3 w-3" /> Admin
              </span>
            </div>
          </div>
          <CardTitle className="font-display text-2xl text-foreground">Admin Access</CardTitle>
          <CardDescription className="text-muted-foreground">
            Restricted — @gametaverns.com accounts only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-foreground/80">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gametaverns.com"
                className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-foreground/80">Password</Label>
              <PasswordInput
                id="admin-password"
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
          <p className="text-xs text-muted-foreground text-center mt-4">
            No registration — admin accounts are provisioned internally.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
