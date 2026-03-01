import { useEffect, useState, useRef } from "react";
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
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import { TotpVerify } from "@/components/auth/TotpVerify";

// Email validation is now handled by the admin_email_allowlist table
// No hardcoded domain restriction

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forceSignedOut, setForceSignedOut] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  const hasSignedOut = useRef(false);
  const { signIn, signOut, isAuthenticated, loading, user, isAdmin, isStaff, roleLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  // Force sign out on mount — admin must always re-authenticate
  useEffect(() => {
    if (hasSignedOut.current) return;
    if (loading) return;

    hasSignedOut.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gt_admin_reauth_ok");
    }

    if (isAuthenticated) {
      signOut().then(() => {
        setForceSignedOut(true);
      });
    } else {
      setForceSignedOut(true);
    }
  }, [loading, isAuthenticated, signOut]);

  // After successful login, check allowlist + role, then redirect to admin panel
  useEffect(() => {
    if (!loading && !roleLoading && isAuthenticated && user?.email && forceSignedOut && !requires2FA) {
      if (isAdmin || isStaff) {
        // Check if email is on the allowlist
        supabase.rpc("is_admin_email_allowed", { _email: user.email }).then(({ data: allowed }) => {
          if (allowed) {
            if (typeof window !== "undefined") {
              sessionStorage.setItem("gt_admin_reauth_ok", "1");
            }
            navigate("/admin", { replace: true });
          } else {
            toast({ title: "Access Denied", description: "Your email is not on the admin allowlist.", variant: "destructive" });
            supabase.auth.signOut();
          }
        });
      } else {
        toast({ title: "Access Denied", description: "You do not have an admin or staff role.", variant: "destructive" });
        supabase.auth.signOut();
      }
    }
  }, [isAuthenticated, loading, roleLoading, navigate, user, isAdmin, isStaff, forceSignedOut, requires2FA]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Error", description: "Please enter your email.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      // Check if user has 2FA enabled — admin always requires verification (ignore grace period)
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
            if (data.isEnabled) {
              setPendingAccessToken(session.access_token);
              setRequires2FA(true);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // Timed out or failed — proceed without 2FA
        }
      }

      // No 2FA required — navigation handled by useEffect
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASuccess = () => {
    setRequires2FA(false);
    setPendingAccessToken(null);
    toast({ title: "Authenticated successfully" });
    // Navigation will be handled by the useEffect
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setRequires2FA(false);
    setPendingAccessToken(null);
  };

  // Show loading while we force sign-out
  if (loading || !forceSignedOut) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted flex items-center justify-center">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  // Show 2FA screen
  if (requires2FA && pendingAccessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <TotpVerify
          accessToken={pendingAccessToken}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      </div>
    );
  }

  // If authenticated after login (waiting for redirect), show nothing
  if (isAuthenticated && !requires2FA) return null;

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
            Restricted — authorized staff accounts only
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
                placeholder="you@example.com"
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
