import { useState } from "react";
import { Loader2, Upload, Link, Users, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

type ImportResult = {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  games: { title: string; id?: string }[];
};

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
  isDemo?: boolean;
  onDemoImport?: (games: any[]) => void;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  isDemo = false,
  onDemoImport,
}: BulkImportDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<ImportMode>("csv");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // CSV mode
  const [csvData, setCsvData] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // BGG Collection mode
  const [bggUsername, setBggUsername] = useState("");

  // BGG Links mode
  const [bggLinks, setBggLinks] = useState("");

  // Common options
  const [enhanceWithBgg, setEnhanceWithBgg] = useState(true);
  const [locationRoom, setLocationRoom] = useState("");
  const [locationShelf, setLocationShelf] = useState("");
  const [locationMisc, setLocationMisc] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const text = await file.text();
    setCsvData(text);
  };

  const resetForm = () => {
    setCsvData("");
    setCsvFile(null);
    setBggUsername("");
    setBggLinks("");
    setLocationRoom("");
    setLocationShelf("");
    setLocationMisc("");
    setResult(null);
  };

  const handleImport = async () => {
    setIsImporting(true);
    setResult(null);

    try {
      const payload: any = {
        mode,
        enhance_with_bgg: enhanceWithBgg,
        default_options: {
          location_room: locationRoom.trim() || null,
          location_shelf: locationShelf.trim() || null,
          location_misc: locationMisc.trim() || null,
        },
      };

      if (mode === "csv") {
        if (!csvData.trim()) {
          toast({
            title: "No data",
            description: "Please upload a CSV file or paste CSV data",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }
        payload.csv_data = csvData;
      } else if (mode === "bgg_collection") {
        if (!bggUsername.trim()) {
          toast({
            title: "Username required",
            description: "Please enter a BoardGameGeek username",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }
        payload.bgg_username = bggUsername.trim();
      } else if (mode === "bgg_links") {
        const links = bggLinks
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && l.includes("boardgamegeek.com"));
        if (links.length === 0) {
          toast({
            title: "No valid links",
            description: "Please enter at least one BoardGameGeek URL",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }
        payload.bgg_links = links;
      }

      if (isDemo && onDemoImport) {
        // Demo mode - simulate import with realistic delay and sample games
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        let demoGames: any[] = [];
        
        if (mode === "csv") {
          // Parse CSV and create demo games from it
          const lines = csvData.trim().split("\n");
          if (lines.length > 1) {
            const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
            const titleIndex = headers.findIndex(h => ["title", "name", "game"].includes(h));
            
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
              if (values[titleIndex !== -1 ? titleIndex : 0]) {
                demoGames.push({
                  id: `demo-import-${Date.now()}-${i}`,
                  title: values[titleIndex !== -1 ? titleIndex : 0],
                  game_type: "Board Game",
                  location_room: locationRoom || "Game Room",
                  location_shelf: locationShelf || null,
                  location_misc: locationMisc || null,
                });
              }
            }
          }
        } else if (mode === "bgg_collection") {
          // Generate sample games for BGG collection import
          const sampleGames = [
            "Wingspan", "Catan", "Ticket to Ride", "Pandemic", "Azul",
            "7 Wonders", "Dominion", "Carcassonne", "Splendor", "Codenames"
          ];
          demoGames = sampleGames.slice(0, 5).map((title, i) => ({
            id: `demo-bgg-${Date.now()}-${i}`,
            title,
            game_type: "Board Game",
            description: `A popular board game imported from BGG collection of ${bggUsername}`,
            location_room: locationRoom || "Game Room",
            location_shelf: locationShelf || null,
            location_misc: locationMisc || null,
          }));
        } else if (mode === "bgg_links") {
          // Extract game names from BGG URLs
          const links = bggLinks.split("\n").filter(l => l.includes("boardgamegeek.com"));
          demoGames = links.map((link, i) => {
            // Try to extract game name from URL (e.g., /boardgame/266192/wingspan)
            const match = link.match(/\/boardgame\/\d+\/([^\/\?]+)/);
            const title = match ? match[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : `Game ${i + 1}`;
            return {
              id: `demo-link-${Date.now()}-${i}`,
              title,
              bgg_url: link,
              game_type: "Board Game",
              description: `Imported from BoardGameGeek`,
              location_room: locationRoom || "Game Room",
              location_shelf: locationShelf || null,
              location_misc: locationMisc || null,
            };
          });
        }
        
        if (demoGames.length > 0) {
          onDemoImport(demoGames);
          setResult({
            success: true,
            imported: demoGames.length,
            failed: 0,
            errors: [],
            games: demoGames.map(g => ({ title: g.title, id: g.id })),
          });
          toast({
            title: "Import complete!",
            description: `Successfully imported ${demoGames.length} game${demoGames.length !== 1 ? "s" : ""} (demo mode)`,
          });
        } else {
          setResult({
            success: false,
            imported: 0,
            failed: 1,
            errors: ["No valid games found to import"],
            games: [],
          });
          toast({
            title: "Import failed",
            description: "No valid games found to import",
            variant: "destructive",
          });
        }
        
        setIsImporting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("bulk-import", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      setResult(data as ImportResult);

      if (data.imported > 0) {
        toast({
          title: "Import complete!",
          description: `Successfully imported ${data.imported} game${data.imported !== 1 ? "s" : ""}${data.failed > 0 ? `. ${data.failed} failed.` : ""}`,
        });
        onImportComplete?.();
      } else if (data.failed > 0) {
        toast({
          title: "Import failed",
          description: `All ${data.failed} games failed to import. Check the errors below.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Games</DialogTitle>
          <DialogDescription>
            Import multiple games at once from CSV, BGG collection, or BGG links
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ImportMode)} className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="csv" className="gap-2">
                <FileText className="h-4 w-4" />
                CSV/Excel
              </TabsTrigger>
              <TabsTrigger value="bgg_collection" className="gap-2">
                <Users className="h-4 w-4" />
                BGG Collection
              </TabsTrigger>
              <TabsTrigger value="bgg_links" className="gap-2">
                <Link className="h-4 w-4" />
                BGG Links
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4 pr-4">
              <TabsContent value="csv" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Upload CSV/Excel File</Label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports CSV files. File should have columns: title (or name/game), optionally bgg_id, bgg_url
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Or Paste CSV Data</Label>
                  <Textarea
                    placeholder={`title,bgg_id
Wingspan,266192
Catan,13
Ticket to Ride,9209`}
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="bgg_collection" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>BoardGameGeek Username</Label>
                  <Input
                    placeholder="Enter BGG username"
                    value={bggUsername}
                    onChange={(e) => setBggUsername(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Import all games marked as "Owned" in your BGG collection
                  </p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Large collections may take several minutes to import. Games already in your
                    library will be skipped.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="bgg_links" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>BoardGameGeek URLs (one per line)</Label>
                  <Textarea
                    placeholder={`https://boardgamegeek.com/boardgame/266192/wingspan
https://boardgamegeek.com/boardgame/13/catan
https://boardgamegeek.com/boardgame/9209/ticket-to-ride`}
                    value={bggLinks}
                    onChange={(e) => setBggLinks(e.target.value)}
                    rows={6}
                  />
                </div>
              </TabsContent>

              {/* Common options */}
              <div className="space-y-4 mt-6 pt-4 border-t">
                <h4 className="font-medium">Import Options</h4>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enhance-bgg"
                    checked={enhanceWithBgg}
                    onCheckedChange={(checked) => setEnhanceWithBgg(!!checked)}
                  />
                  <Label htmlFor="enhance-bgg" className="cursor-pointer">
                    Enhance with BGG data (descriptions, images, player counts, etc.)
                  </Label>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Default Room</Label>
                    <Select value={locationRoom} onValueChange={setLocationRoom}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="Living Room">Living Room</SelectItem>
                        <SelectItem value="Family Room">Family Room</SelectItem>
                        <SelectItem value="Game Room">Game Room</SelectItem>
                        <SelectItem value="Den">Den</SelectItem>
                        <SelectItem value="Basement">Basement</SelectItem>
                        <SelectItem value="Bedroom">Bedroom</SelectItem>
                        <SelectItem value="Office">Office</SelectItem>
                        <SelectItem value="Closet">Closet</SelectItem>
                        <SelectItem value="Attic">Attic</SelectItem>
                        <SelectItem value="Garage">Garage</SelectItem>
                        <SelectItem value="Dining Room">Dining Room</SelectItem>
                        <SelectItem value="Storage Room">Storage Room</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default Shelf</Label>
                    <Input
                      placeholder="e.g., Shelf A"
                      value={locationShelf}
                      onChange={(e) => setLocationShelf(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default Misc</Label>
                    <Input
                      placeholder="e.g., Box 1"
                      value={locationMisc}
                      onChange={(e) => setLocationMisc(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Results */}
              {result && (
                <div className="space-y-3 mt-6 pt-4 border-t">
                  <h4 className="font-medium flex items-center gap-2">
                    {result.imported > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    Import Results
                  </h4>

                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">✓ {result.imported} imported</span>
                    {result.failed > 0 && (
                      <span className="text-destructive">✕ {result.failed} failed</span>
                    )}
                  </div>

                  {result.errors.length > 0 && (
                    <div className="bg-muted rounded p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium mb-2">Errors:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {result.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {result.errors.length > 10 && (
                          <li>...and {result.errors.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {result.games.length > 0 && (
                    <div className="bg-muted rounded p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium mb-2">Imported games:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {result.games.slice(0, 10).map((g, i) => (
                          <li key={i}>• {g.title}</li>
                        ))}
                        {result.games.length > 10 && (
                          <li>...and {result.games.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </Tabs>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <>
              <Button variant="outline" onClick={resetForm}>
                Import More
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
