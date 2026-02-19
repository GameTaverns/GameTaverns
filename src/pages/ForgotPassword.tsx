import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { TurnstileWidget } from "@/components/games/TurnstileWidget";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";

export default function ForgotPassword() {
  const isNative = Capacitor.isNativePlatform();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(isNative ? "bypass" : null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNative && !turnstileToken) {
      toast({ title: "Please complete verification", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      if (isSelfHostedMode()) {
        // Self-hosted: use Express API
        await apiClient.post('/auth/forgot-password', { email });
      } else {
        // Cloud mode: use Supabase edge function
        const { error } = await supabase.functions.invoke('send-auth-email', {
          body: {
            type: 'password_reset',
            email: email,
            redirectUrl: window.location.origin,
          },
        });
        if (error) throw error;
      }

      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md bg-card/80 dark:bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
            <span className="font-display text-2xl font-bold text-foreground">GameTaverns</span>
          </Link>
          <CardTitle className="font-display text-2xl text-foreground">Reset Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            {emailSent 
              ? "Check your email for a reset link" 
              : "Enter your email to receive a password reset link"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center p-6 bg-muted/50 dark:bg-wood-medium/30 rounded-lg">
                <Mail className="h-12 w-12 text-secondary" />
              </div>
              <p className="text-center text-foreground/80">
                If an account exists for <strong>{email}</strong>, you'll receive an email with instructions to reset your password.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                Try a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              {!isNative && (
                <TurnstileWidget
                  key={turnstileKey}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                />
              )}
              <Button
                type="submit"
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
                disabled={isLoading || (!isNative && !turnstileToken)}
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="inline-flex items-center gap-2 text-secondary hover:text-secondary/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
