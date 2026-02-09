import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, History, CheckCircle2, AlertCircle, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedSupabaseStack } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import { useTenant } from "@/contexts/TenantContext";

interface PlayImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  details?: {
    importedPlays: string[];
    skippedDuplicates: string[];
    unmatchedGames: string[];
  };
}

interface PlayHistoryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function PlayHistoryImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: PlayHistoryImportDialogProps) {
  const { toast } = useToast();
  const { library } = useTenant();
  const queryClient = useQueryClient();
  const [bggUsername, setBggUsername] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<PlayImportResult | null>(null);

  const resetForm = () => {
    setBggUsername("");
    setResult(null);
  };

  const handleImport = async () => {
    if (!bggUsername.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a BoardGameGeek username",
        variant: "destructive",
      });
      return;
    }

    if (!library?.id) {
      toast({
        title: "No library selected",
        description: "Please select a library first",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in to import plays",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      const { url: apiUrl, anonKey } = getSupabaseConfig();
      const fullUrl = `${apiUrl}/functions/v1/bgg-play-import`;

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "apikey": anonKey,
        },
        body: JSON.stringify({
          bgg_username: bggUsername.trim(),
          library_id: library.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);

      // Invalidate play-related queries
      queryClient.invalidateQueries({ queryKey: ["game-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["play-stats"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-trends"] });
      queryClient.invalidateQueries({ queryKey: ["library-analytics-top-games"] });

      if (data.imported > 0) {
        toast({
          title: "Import complete!",
          description: `Imported ${data.imported} play${data.imported !== 1 ? "s" : ""}${data.skipped > 0 ? `, skipped ${data.skipped} duplicates` : ""}${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
        });
        onImportComplete?.();
      } else if (data.skipped > 0) {
        toast({
          title: "All plays already imported",
          description: `Skipped ${data.skipped} duplicate play${data.skipped !== 1 ? "s" : ""}`,
        });
      } else {
        toast({
          title: "No plays imported",
          description: data.details?.unmatchedGames?.length > 0
            ? `${data.details.unmatchedGames.length} games not found in your library`
            : "No matching plays found",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Play import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      resetForm();
      onOpenChange(false);
    }
  };

  // Only available on self-hosted Supabase stack
  const isAvailable = isSelfHostedSupabaseStack();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Import Play History from BGG
          </DialogTitle>
          <DialogDescription>
            Import your logged plays from BoardGameGeek and merge them with your library
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {!isAvailable ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Feature Not Available</AlertTitle>
              <AlertDescription>
                Play history import is only available on self-hosted installations.
                This feature requires direct access to the BGG API which is not available in Lovable Cloud.
              </AlertDescription>
            </Alert>
          ) : result ? (
            <div className="space-y-4">
              <Alert variant={result.imported > 0 ? "default" : "destructive"}>
                {result.imported > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>Import Results</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-primary">✓ {result.imported} plays imported</p>
                    {result.skipped > 0 && (
                      <p className="text-muted-foreground">↷ {result.skipped} duplicates skipped</p>
                    )}
                    {result.failed > 0 && (
                      <p className="text-destructive">✕ {result.failed} failed</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {result.details?.unmatchedGames && result.details.unmatchedGames.length > 0 && (
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertTitle>Games Not in Your Library</AlertTitle>
                  <AlertDescription>
                    <p className="text-sm mb-2">
                      These games from your BGG plays weren't found in your library:
                    </p>
                    <ScrollArea className="h-32">
                      <ul className="text-xs space-y-1">
                        {result.details.unmatchedGames.slice(0, 20).map((game, i) => (
                          <li key={i} className="text-muted-foreground">• {game}</li>
                        ))}
                        {result.details.unmatchedGames.length > 20 && (
                          <li className="text-muted-foreground italic">
                            ...and {result.details.unmatchedGames.length - 20} more
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-2">
                      Tip: Import these games first, then re-run the play import.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Errors</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="h-24">
                      <ul className="text-xs space-y-1">
                        {result.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={resetForm} className="w-full">
                Import More
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bgg-username">BoardGameGeek Username</Label>
                <Input
                  id="bgg-username"
                  placeholder="Enter your BGG username"
                  value={bggUsername}
                  onChange={(e) => setBggUsername(e.target.value)}
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  We'll fetch all your logged plays from BGG and match them to games in your library.
                </p>
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Smart Merge</AlertTitle>
                <AlertDescription className="text-sm space-y-2">
                  <p>The import will:</p>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    <li>Match BGG plays to games in your library by BGG ID or title</li>
                    <li>Import player names, scores, and win status</li>
                    <li>Skip plays you've already imported (no duplicates)</li>
                    <li>Handle multi-play sessions (e.g., "played 3 times")</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {isImporting && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">Importing plays...</span>
                  </div>
                  <Progress className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    This may take a while for large play histories...
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && isAvailable && (
            <Button onClick={handleImport} disabled={isImporting || !bggUsername.trim()}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <History className="h-4 w-4 mr-2" />
                  Import Plays
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
