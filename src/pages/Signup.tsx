import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: displayName || email.split("@")[0],
          },
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Account created!",
        description: "Welcome to GameTaverns. Let's set up your library.",
      });
      
      navigate("/create-library");
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-amber-800/30 border-amber-700/50">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <Gamepad2 className="h-10 w-10 text-amber-400" />
            <span className="font-display text-3xl font-bold text-amber-100">
              GameTaverns
            </span>
          </Link>
          <CardTitle className="text-2xl text-amber-100">Create Account</CardTitle>
          <CardDescription className="text-amber-200/70">
            Start building your board game library
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-amber-200">
                Display Name <span className="text-amber-200/40">(optional)</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-amber-200">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-amber-200">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-amber-200">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-amber-900/50 border-amber-700/50 text-amber-100 placeholder:text-amber-200/40"
                required
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
              disabled={isLoading}
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
            <p className="text-amber-200/70">
              Already have an account?{" "}
              <Link to="/login" className="text-amber-400 hover:text-amber-300 underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
