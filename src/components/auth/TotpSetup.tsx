import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getSupabaseConfig } from "@/config/runtime";
import QRCode from "@/components/auth/QRCode";

interface TotpSetupProps {
  onComplete?: () => void;
  isRequired?: boolean;
}

export function TotpSetup({ onComplete, isRequired = false }: TotpSetupProps) {
  const [step, setStep] = useState<"intro" | "qr" | "verify" | "backup">("intro");
  const [isLoading, setIsLoading] = useState(false);
  const [otpauthUri, setOtpauthUri] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("You must be logged in to set up 2FA");
        return;
      }

      const response = await fetch(`${apiUrl}/functions/v1/totp-setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ action: "generate" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate TOTP secret");
      }

      setOtpauthUri(data.otpauthUri);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep("qr");
    } catch (e: any) {
      setError(e.message || "Failed to start 2FA setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length < 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Session expired. Please log in again.");
        return;
      }

      const response = await fetch(`${apiUrl}/functions/v1/totp-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ code: verificationCode, action: "setup" }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.error || "Invalid verification code");
      }

      setStep("backup");
    } catch (e: any) {
      setError(e.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedBackup(true);
    toast({ title: "Backup codes copied to clipboard" });
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleComplete = () => {
    toast({ title: "Two-factor authentication enabled!", description: "Your account is now more secure." });
    if (onComplete) {
      onComplete();
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-display text-xl">
          {step === "intro" && "Set Up Two-Factor Authentication"}
          {step === "qr" && "Scan QR Code"}
          {step === "verify" && "Verify Setup"}
          {step === "backup" && "Save Backup Codes"}
        </CardTitle>
        <CardDescription>
          {step === "intro" && (isRequired 
            ? "Two-factor authentication is required for your account security."
            : "Add an extra layer of security to your account.")}
          {step === "qr" && "Use your authenticator app to scan this QR code"}
          {step === "verify" && "Enter the 6-digit code from your authenticator app"}
          {step === "backup" && "Save these codes somewhere safe - you'll need them if you lose your device"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "intro" && (
          <>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>You'll need an authenticator app like:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Google Authenticator</li>
                <li>Authy</li>
                <li>Microsoft Authenticator</li>
                <li>1Password</li>
              </ul>
            </div>
            <Button onClick={handleStartSetup} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Get Started
            </Button>
          </>
        )}

        {step === "qr" && (
          <>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCode value={otpauthUri} size={200} />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Can't scan? Enter this key manually:</Label>
              <div className="flex gap-2">
                <Input 
                  value={secret} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopySecret}>
                  {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button onClick={() => setStep("verify")} className="w-full">
              Continue
            </Button>
          </>
        )}

        {step === "verify" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("qr")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleVerify} disabled={isLoading || verificationCode.length < 6} className="flex-1">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify
              </Button>
            </div>
          </>
        )}

        {step === "backup" && (
          <>
            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono bg-background px-2 py-1 rounded text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>
            
            <Button variant="outline" onClick={handleCopyBackupCodes} className="w-full">
              {copiedBackup ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              Copy Backup Codes
            </Button>
            
            <Alert>
              <AlertDescription className="text-sm">
                Each backup code can only be used once. Store them securely - they're your only way in if you lose your authenticator device.
              </AlertDescription>
            </Alert>
            
            <Button onClick={handleComplete} className="w-full">
              I've Saved My Backup Codes
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
