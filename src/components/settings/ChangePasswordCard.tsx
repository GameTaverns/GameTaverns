import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";
import { validatePassword, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-validation";

export function ChangePasswordCard() {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast({ title: "Password does not meet requirements", description: validation.errors[0], variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check password reuse + policy (server-side validation)
      const { data: reuseData, error: reuseError } = await supabase.functions.invoke('check-password-reuse', {
        body: { userId: user.id, password: newPassword, action: 'check' },
      });
      if (reuseError) throw reuseError;
      if (reuseData?.reused) {
        toast({ title: "Password previously used", description: reuseData.error, variant: "destructive" });
        return;
      }
      if (reuseData?.policyError) {
        toast({ title: "Password does not meet requirements", description: reuseData.error, variant: "destructive" });
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Store the new password hash for reuse prevention
      await supabase.functions.invoke('check-password-reuse', {
        body: { userId: user.id, password: newPassword, action: 'store' },
      });

      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Error updating password", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">{PASSWORD_REQUIREMENTS_TEXT} You cannot reuse any of your last 20 passwords.</p>
          <Button type="submit" disabled={isUpdating || !newPassword || !confirmPassword || !validatePassword(newPassword).valid} className="w-full sm:w-auto">
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
