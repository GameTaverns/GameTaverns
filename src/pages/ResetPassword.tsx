import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [tokenEmail, setTokenEmail] = useState<string>("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = searchParams.get('token');

  useEffect(() => {
    const verifyToken = async () => {
      // Check for custom token first
      if (token) {
        try {
          let valid = false;
          let email = '';
          
          if (isSelfHostedMode()) {
            // Self-hosted: use Express API
            const result = await apiClient.post<{ valid: boolean; email?: string }>('/auth/verify-reset-token', { token });
            valid = result.valid;
            email = result.email || '';
          } else {
            // Cloud mode: use Supabase edge function
            const { data, error } = await supabase.functions.invoke('verify-reset-token', {
              body: { token, action: 'verify' },
            });
            if (error || !data?.valid) {
              setIsValidToken(false);
              return;
            }
            valid = data.valid;
            email = data.email || '';
          }

          if (!valid) {
            setIsValidToken(false);
            return;
          }

          setIsValidToken(true);
          setTokenEmail(email);
        } catch (err) {
          console.error('Token verification error:', err);
          setIsValidToken(false);
        }
        return;
      }

      // Fall back to Supabase recovery flow (for backwards compatibility - cloud only)
      if (!isSelfHostedMode()) {
        const { data: { session } } = await supabase.auth.getSession();
        setIsValidToken(!!session);
      } else {
        // Self-hosted without token = invalid
        setIsValidToken(false);
      }
    };

    verifyToken();

    // Listen for auth state changes (recovery link clicked - legacy flow, cloud only)
    if (!isSelfHostedMode()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsValidToken(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
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

    setIsLoading(true);

    try {
      if (isSelfHostedMode()) {
        // Self-hosted: use Express API
        await apiClient.post('/auth/reset-password', { token, newPassword: password });
      } else if (token) {
        // Cloud mode with custom token
        const { data, error } = await supabase.functions.invoke('verify-reset-token', {
          body: { token, action: 'reset', newPassword: password },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to reset password');
      } else {
        // Legacy Supabase flow (cloud only)
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }

      setIsSuccess(true);
      toast({
        title: "Password updated",
        description: "Your password has been reset successfully.",
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking token
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center">
        <div className="flex items-center gap-2 text-cream">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Verifying...</span>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <Link to="/" className="flex items-center justify-center gap-3 mb-4">
              <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
              <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
            </Link>
            <CardTitle className="font-display text-2xl text-cream">Invalid Link</CardTitle>
            <CardDescription className="text-muted-foreground">
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-center text-cream/80">
                Please request a new password reset link.
              </p>
              <Button
                asChild
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
              >
                <Link to="/forgot-password">Request New Link</Link>
              </Button>
              <div className="text-center">
                <Link 
                  to="/login" 
                  className="text-secondary hover:text-secondary/80"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
          </Link>
          <CardTitle className="font-display text-2xl text-cream">
            {isSuccess ? "Password Reset!" : "Set New Password"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isSuccess 
              ? "You can now sign in with your new password" 
              : tokenEmail 
                ? `Enter a new password for ${tokenEmail}`
                : "Enter your new password below"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center p-6 bg-wood-medium/30 rounded-lg">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-center text-cream/80">
                Redirecting you to sign in...
              </p>
              <Button
                asChild
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
              >
                <Link to="/login">Sign In Now</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-cream/80">New Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-cream/80">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
