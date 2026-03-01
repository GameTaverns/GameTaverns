import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface AdminEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userDisplayName: string;
  currentAdminEmail: string | null;
}

export function AdminEmailDialog({ open, onOpenChange, userId, userDisplayName, currentAdminEmail }: AdminEmailDialogProps) {
  const queryClient = useQueryClient();
  const [adminEmail, setAdminEmail] = useState(currentAdminEmail || "");

  const saveMutation = useMutation({
    mutationFn: async (newAdminEmail: string | null) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({ admin_email: newAdminEmail })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-admin-emails"] });
      toast.success("Admin email updated");
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to update";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error("That @gametaverns.com email is already assigned to another user");
      } else {
        toast.error(msg);
      }
    },
  });

  const handleSave = () => {
    const trimmed = adminEmail.trim().toLowerCase();
    if (trimmed && !trimmed.endsWith("@gametaverns.com")) {
      toast.error("Admin email must be @gametaverns.com");
      return;
    }
    saveMutation.mutate(trimmed || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-sidebar border-wood-medium/50">
        <DialogHeader>
          <DialogTitle className="text-cream flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-secondary" />
            Assign Admin Email
          </DialogTitle>
          <DialogDescription className="text-cream/70">
            Assign a @gametaverns.com email alias to <span className="font-medium text-cream">{userDisplayName}</span>.
            They'll use this alias to log into the admin panel with their regular password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-cream/80">Admin Email (@gametaverns.com)</Label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="username@gametaverns.com"
              className="bg-wood-medium/30 border-wood-medium/50 text-cream placeholder:text-cream/40"
            />
            <p className="text-xs text-cream/50">
              Leave empty to remove the admin email alias. The user will need an admin/staff role to access the admin panel.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-wood-medium/50 text-cream"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-secondary text-secondary-foreground"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
