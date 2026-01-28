import { useState } from "react";
import { AlertTriangle, Trash2, Database, UserX } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type ActionType = "clear_library" | "delete_library" | "delete_account" | null;

export function DangerZone() {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { data: library } = useMyLibrary();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmationText, setConfirmationText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const getRequiredText = () => {
    if (currentAction === "delete_account") {
      return user?.email || "";
    }
    return library?.name || "";
  };

  const getActionDetails = () => {
    switch (currentAction) {
      case "clear_library":
        return {
          title: "Clear Library",
          description: "This will permanently delete ALL games from your library. Your library settings and configuration will be preserved.",
          warning: "All games, ratings, wishlist entries, play logs, and messages will be permanently deleted.",
          confirmLabel: "library name",
          icon: Database,
        };
      case "delete_library":
        return {
          title: "Delete Library",
          description: "This will permanently delete your entire library, including all games, settings, and configuration.",
          warning: "Your account will remain active, and you can create a new library with a different URL.",
          confirmLabel: "library name",
          icon: Trash2,
        };
      case "delete_account":
        return {
          title: "Delete Account",
          description: "This will permanently delete your account and all associated data.",
          warning: "All libraries, games, and personal data will be permanently deleted. This action cannot be undone.",
          confirmLabel: "email address",
          icon: UserX,
        };
      default:
        return null;
    }
  };

  const handleAction = async () => {
    if (!currentAction) return;
    
    const requiredText = getRequiredText();
    if (confirmationText.toLowerCase() !== requiredText.toLowerCase()) {
      toast({
        title: "Confirmation failed",
        description: `Please type "${requiredText}" exactly to confirm.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("manage-account", {
        body: {
          action: currentAction,
          libraryId: library?.id,
          confirmationText,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Action failed");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Action failed");
      }

      toast({
        title: "Success",
        description: response.data.message,
      });

      // Handle post-action navigation
      if (currentAction === "delete_account") {
        await signOut();
        navigate("/");
      } else if (currentAction === "delete_library") {
        navigate("/dashboard");
        window.location.reload();
      } else {
        // Clear library - invalidate queries for a smooth refresh
        await queryClient.invalidateQueries({ queryKey: ["games"] });
        await queryClient.invalidateQueries({ queryKey: ["library"] });
      }
    } catch (error) {
      console.error("Action error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setCurrentAction(null);
      setConfirmStep(1);
      setConfirmationText("");
    }
  };

  const handleClose = () => {
    setCurrentAction(null);
    setConfirmStep(1);
    setConfirmationText("");
  };

  const actionDetails = getActionDetails();

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Clear Library */}
          {library && (
            <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-background">
              <div>
                <h4 className="font-medium text-foreground">Clear Library</h4>
                <p className="text-sm text-muted-foreground">
                  Delete all games from your library. Settings will be preserved.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  setCurrentAction("clear_library");
                  setConfirmStep(1);
                }}
              >
                <Database className="h-4 w-4 mr-2" />
                Clear Games
              </Button>
            </div>
          )}

          {/* Delete Library */}
          {library && (
            <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-background">
              <div>
                <h4 className="font-medium text-foreground">Delete Library</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your library. You can create a new one afterward.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  setCurrentAction("delete_library");
                  setConfirmStep(1);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Library
              </Button>
            </div>
          )}

          {/* Delete Account */}
          <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-background">
            <div>
              <h4 className="font-medium text-foreground">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setCurrentAction("delete_account");
                setConfirmStep(1);
              }}
            >
              <UserX className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog (single dialog; content switches by step) */}
      <AlertDialog open={currentAction !== null} onOpenChange={(open) => !open && handleClose()}>
        <AlertDialogContent>
          {confirmStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  {actionDetails?.icon && <actionDetails.icon className="h-5 w-5" />}
                  {actionDetails?.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>{actionDetails?.description}</p>
                  <p className="font-medium text-destructive">{actionDetails?.warning}</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmStep(2)}
                >
                  I understand, continue
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Confirm {actionDetails?.title}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  To confirm this action, please type your {actionDetails?.confirmLabel} below:
                  <span className="block mt-2 font-mono text-foreground bg-muted px-2 py-1 rounded">
                    {getRequiredText()}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="confirmation" className="sr-only">
                  Confirmation
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={`Type "${getRequiredText()}" to confirm`}
                  className="font-mono"
                  disabled={isProcessing}
                />
              </div>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmStep(1);
                    setConfirmationText("");
                  }}
                  disabled={isProcessing}
                >
                  Back
                </Button>
                <AlertDialogCancel onClick={handleClose} disabled={isProcessing}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleAction}
                  disabled={isProcessing || confirmationText.toLowerCase() !== getRequiredText().toLowerCase()}
                >
                  {isProcessing ? "Processing..." : `Confirm ${actionDetails?.title}`}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
