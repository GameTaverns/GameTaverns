import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseConfig } from "@/config/runtime";

interface TotpVerifyProps {
  accessToken: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function TotpVerify({ accessToken, onSuccess, onCancel }: TotpVerifyProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);
  
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Please enter a valid code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/functions/v1/totp-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ code, action: "login" }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.error || "Invalid code");
      }

      if (data.method === "backup_code" && typeof data.remaining_backup_codes === "number") {
        setRemainingCodes(data.remaining_backup_codes);
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="font-display text-xl">Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app, or use a backup code
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {remainingCodes !== null && remainingCodes <= 2 && (
          <Alert>
            <AlertDescription>
              You have {remainingCodes} backup code{remainingCodes !== 1 ? "s" : ""} remaining. 
              Consider regenerating your backup codes in settings.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="totp-code">Authentication Code</Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
            onKeyDown={handleKeyDown}
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-center">
            Enter your 6-digit authenticator code or 8-character backup code
          </p>
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleVerify} 
            disabled={isLoading || code.length < 6} 
            className={onCancel ? "flex-1" : "w-full"}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
