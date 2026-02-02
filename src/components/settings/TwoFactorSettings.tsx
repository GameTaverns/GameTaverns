import { useState } from "react";
import { Shield, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTotpStatus } from "@/hooks/useTotpStatus";
import { TotpSetup } from "@/components/auth/TotpSetup";
import { supabase } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";

export function TwoFactorSettings() {
  const { status, loading, refetch } = useTotpStatus();
  const { toast } = useToast();
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState("");
  const { url: apiUrl, anonKey } = getSupabaseConfig();

  const handleSetupComplete = () => {
    setShowSetup(false);
    refetch();
    toast({ 
      title: "2FA Enabled", 
      description: "Your account is now protected with two-factor authentication." 
    });
  };

  const handleDisable = async () => {
    if (disableCode.length < 6) {
      setDisableError("Please enter a valid code");
      return;
    }

    setIsDisabling(true);
    setDisableError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDisableError("Session expired. Please log in again.");
        return;
      }

      const response = await fetch(`${apiUrl}/functions/v1/totp-disable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ code: disableCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disable 2FA");
      }

      setShowDisable(false);
      setDisableCode("");
      refetch();
      toast({ 
        title: "2FA Disabled", 
        description: "Two-factor authentication has been removed from your account." 
      });
    } catch (e: any) {
      setDisableError(e.message || "Failed to disable 2FA");
    } finally {
      setIsDisabling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.isEnabled ? (
          <>
            <div className="flex items-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-medium">Two-factor authentication is enabled</span>
            </div>
            
            {status.remainingBackupCodes <= 2 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You only have {status.remainingBackupCodes} backup code{status.remainingBackupCodes !== 1 ? "s" : ""} remaining. 
                  Consider regenerating your backup codes.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              Enabled since {status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : "unknown"}
            </p>

            <div className="flex gap-2">
              <Dialog open={showSetup} onOpenChange={setShowSetup}>
                <DialogTrigger asChild>
                  <Button variant="outline">Regenerate Backup Codes</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <TotpSetup onComplete={handleSetupComplete} />
                </DialogContent>
              </Dialog>

              <Dialog open={showDisable} onOpenChange={setShowDisable}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Disable 2FA</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                    <DialogDescription>
                      Enter your current authenticator code to disable 2FA. This will make your account less secure.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {disableError && (
                      <Alert variant="destructive">
                        <AlertDescription>{disableError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="disable-code">Authenticator Code</Label>
                      <Input
                        id="disable-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                        className="text-center text-xl tracking-widest font-mono"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowDisable(false)}>
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleDisable}
                        disabled={isDisabling || disableCode.length < 6}
                      >
                        {isDisabling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Disable 2FA
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Protect your account by requiring a verification code from your authenticator app when signing in.
            </p>

            <Dialog open={showSetup} onOpenChange={setShowSetup}>
              <DialogTrigger asChild>
                <Button>
                  <Shield className="h-4 w-4 mr-2" />
                  Set Up 2FA
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <TotpSetup onComplete={handleSetupComplete} />
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
