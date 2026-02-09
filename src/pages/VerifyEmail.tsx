import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSelfHostedMode, apiClient } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";

type VerificationStatus = "verifying" | "success" | "error" | "no-token";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<VerificationStatus>(token ? "verifying" : "no-token");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    const verifyEmail = async () => {
      try {
        let data: { valid?: boolean; email?: string; error?: string };

        if (isSelfHostedMode()) {
          // Self-hosted: call local API
          data = await apiClient.post<{ valid?: boolean; email?: string; error?: string }>(
            "/auth/verify-email",
            { token }
          );
        } else {
          // Cloud mode: call Supabase Edge Function
          const { url: apiUrl, anonKey } = getSupabaseConfig();
          const response = await fetch(
            `${apiUrl}/functions/v1/verify-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
              },
              body: JSON.stringify({ token }),
            }
          );
          data = await response.json();
        }

        if (data.valid) {
          setStatus("success");
          setEmail(data.email || "");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Verification failed");
        }
      } catch (error: any) {
        console.error("Verification error:", error);
        setStatus("error");
        setErrorMessage(error.message || "An unexpected error occurred");
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-sidebar/80 border-border/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImage} alt="GameTaverns" className="h-16 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">GameTaverns</span>
          </Link>
          
          {status === "verifying" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                Verifying Your Email
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Please wait while we confirm your email address...
              </CardDescription>
            </>
          )}
          
          {status === "success" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Email Verified!
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Your email has been confirmed successfully.
              </CardDescription>
            </>
          )}
          
          {status === "error" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <XCircle className="h-6 w-6 text-destructive" />
                Verification Failed
              </CardTitle>
              <CardDescription className="text-destructive">
                {errorMessage}
              </CardDescription>
            </>
          )}
          
          {status === "no-token" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <Mail className="h-6 w-6" />
                Email Verification
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                No verification token provided.
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {status === "success" && (
            <>
              <p className="text-cream/80">
                Welcome to GameTaverns! You can now sign in to your account.
              </p>
              <Button
                onClick={() => navigate("/login")}
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
              >
                Sign In
              </Button>
            </>
          )}
          
          {status === "error" && (
            <>
              <p className="text-cream/80">
                The verification link may have expired or already been used. 
                Please try signing up again or contact support if you continue to have issues.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => navigate("/signup")}
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display"
                >
                  Sign Up Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/login")}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}
          
          {status === "no-token" && (
            <>
              <p className="text-cream/80">
                Please use the link from your confirmation email to verify your account.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/login")}
                className="w-full"
              >
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
