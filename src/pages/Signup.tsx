import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TurnstileWidget } from "@/components/games/TurnstileWidget";
// IMPORTANT: we do NOT call supabase.auth.signUp() here because it triggers the default
// provider confirmation email. We use a backend function that creates the user and
// sends our branded SMTP confirmation email.

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({
        title: "Verification required",
        description: "Please complete the verification challenge",
        variant: "destructive",
      });
      return;
    }
    
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            displayName: displayName || email.split("@")[0],
            redirectUrl: window.location.origin,
            turnstile_token: turnstileToken,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Signup failed");
      }

      toast({
        title: "Check your email!",
        description: "We've sent you a confirmation link. Please verify your email to continue.",
      });
      
      navigate("/login", { 
        state: { message: "Please check your email and click the confirmation link to activate your account." } 
      });
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
      // Reset turnstile on failure
      setTurnstileToken(null);
      setTurnstileKey(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
          </Link>
          <CardTitle className="font-display text-2xl text-cream">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Start building your board game library
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-cream/80">
                Display Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-cream/80">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-cream/80">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-cream/80">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-wood-medium/50 border-border/50 text-cream placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-cream/80">Verification</Label>
              <TurnstileWidget
                key={turnstileKey}
                onVerify={handleTurnstileVerify}
                onExpire={handleTurnstileExpire}
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
              disabled={isLoading || !turnstileToken}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-secondary hover:text-secondary/80 underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}