import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSelfHostedMode, apiClient } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";

type VerificationStatus = "verifying" | "success" | "error" | "no-token";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<VerificationStatus>(token ? "verifying" : "no-token");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!token) { setStatus("no-token"); return; }
    const verifyEmail = async () => {
      try {
        let data: { valid?: boolean; email?: string; error?: string };
        if (isSelfHostedMode()) {
          data = await apiClient.post<{ valid?: boolean; email?: string; error?: string }>("/auth/verify-email", { token });
        } else {
          const { url: apiUrl, anonKey } = getSupabaseConfig();
          const response = await fetch(`${apiUrl}/functions/v1/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
            body: JSON.stringify({ token }),
          });
          data = await response.json();
        }
        if (data.valid) { setStatus("success"); setEmail(data.email || ""); }
        else { setStatus("error"); setErrorMessage(data.error || "Verification failed"); }
      } catch (error: any) {
        console.error("Verification error:", error);
        setStatus("error");
        setErrorMessage(error.message || "An unexpected error occurred");
      }
    };
    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex items-center justify-center p-4">
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
                {t('verifyEmail.verifyingTitle')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">{t('verifyEmail.verifyingDesc')}</CardDescription>
            </>
          )}
          
          {status === "success" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                {t('verifyEmail.successTitle')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">{t('verifyEmail.successDesc')}</CardDescription>
            </>
          )}
          
          {status === "error" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <XCircle className="h-6 w-6 text-destructive" />
                {t('verifyEmail.errorTitle')}
              </CardTitle>
              <CardDescription className="text-destructive">{errorMessage}</CardDescription>
            </>
          )}
          
          {status === "no-token" && (
            <>
              <CardTitle className="font-display text-2xl text-cream flex items-center justify-center gap-2">
                <Mail className="h-6 w-6" />
                {t('verifyEmail.noTokenTitle')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">{t('verifyEmail.noTokenDesc')}</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          {status === "success" && (
            <>
              <p className="text-cream/80">{t('verifyEmail.successBody')}</p>
              <Button onClick={() => navigate("/login")} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display">
                {t('verifyEmail.signIn')}
              </Button>
            </>
          )}
          
          {status === "error" && (
            <>
              <p className="text-cream/80">{t('verifyEmail.errorBody')}</p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/signup")} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-display">
                  {t('verifyEmail.signUpAgain')}
                </Button>
                <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                  {t('verifyEmail.backToLogin')}
                </Button>
              </div>
            </>
          )}
          
          {status === "no-token" && (
            <>
              <p className="text-cream/80">{t('verifyEmail.noTokenBody')}</p>
              <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                {t('verifyEmail.backToLogin')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
