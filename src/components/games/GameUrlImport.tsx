import { useState } from "react";
import { Loader2, Link, MapPin, DollarSign, Calendar, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedMode } from "@/integrations/backend/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAllGamesFlat } from "@/hooks/useGames";
import { SALE_CONDITION_OPTIONS, type SaleCondition } from "@/types/game";

interface GameUrlImportProps {
  libraryId?: string;
}

export function GameUrlImport({ libraryId }: GameUrlImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: baseGames = [] } = useAllGamesFlat();
  
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [lastImportedGameTitle, setLastImportedGameTitle] = useState("");
  
  // Import options
  const [importAsComingSoon, setImportAsComingSoon] = useState(false);
  const [importAsForSale, setImportAsForSale] = useState(false);
  const [importAsExpansion, setImportAsExpansion] = useState(false);
  const [importParentGameId, setImportParentGameId] = useState<string | null>(null);
  
  // Sale dialog
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [importSalePrice, setImportSalePrice] = useState("");
  const [importSaleCondition, setImportSaleCondition] = useState<SaleCondition | null>(null);
  
  // Location dialog
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [importLocationRoom, setImportLocationRoom] = useState("");
  const [importLocationShelf, setImportLocationShelf] = useState("");
  const [importLocationMisc, setImportLocationMisc] = useState("");
  
  // Purchase details dialog (private to library owner)
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [importPurchasePrice, setImportPurchasePrice] = useState("");
  const [importPurchaseDate, setImportPurchaseDate] = useState("");
  
  // Extra options
  const [importSleeved, setImportSleeved] = useState(false);
  const [importUpgradedComponents, setImportUpgradedComponents] = useState(false);
  const [importCrowdfunded, setImportCrowdfunded] = useState(false);
  const [importInserts, setImportInserts] = useState(false);

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a BoardGameGeek URL",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bgg-import", {
        body: { 
          url: importUrl.trim(),
          library_id: libraryId,
          is_coming_soon: importAsComingSoon,
          is_for_sale: importAsForSale,
          sale_price: importAsForSale && importSalePrice ? parseFloat(importSalePrice) : null,
          sale_condition: importAsForSale ? importSaleCondition : null,
          is_expansion: importAsExpansion,
          parent_game_id: importAsExpansion ? importParentGameId : null,
          location_room: importLocationRoom || null,
          location_shelf: importLocationShelf || null,
          location_misc: importLocationMisc || null,
          purchase_price: importPurchasePrice ? parseFloat(importPurchasePrice) : null,
          purchase_date: importPurchaseDate || null,
          sleeved: importSleeved,
          upgraded_components: importUpgradedComponents,
          crowdfunded: importCrowdfunded,
          inserts: importInserts,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const wasUpdated = data.action === "updated";
      setLastImportedGameTitle(data.game.title);
      toast({
        title: wasUpdated ? "Game Updated!" : "Game Added!",
        description: wasUpdated
          ? `"${data.game.title}" was already in your library and has been updated with the latest data.`
          : `Successfully added "${data.game.title}" to your library.`,
      });
      
      // Reset form
      setImportUrl("");
      setImportAsComingSoon(false);
      setImportAsForSale(false);
      setImportAsExpansion(false);
      setImportParentGameId(null);
      setImportSalePrice("");
      setImportSaleCondition(null);
      setImportLocationRoom("");
      setImportLocationShelf("");
      setImportLocationMisc("");
      setImportPurchasePrice("");
      setImportPurchaseDate("");
      setImportSleeved(false);
      setImportUpgradedComponents(false);
      setImportCrowdfunded(false);
      setImportInserts(false);
      
      // Refresh games list
      queryClient.invalidateQueries({ queryKey: ["games"] });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import game from URL",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Quick Add from URL
          </CardTitle>
          <CardDescription>
            Import a game directly from BoardGameGeek with all its details.
            You can safely navigate away after clicking Import — the process runs on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="bgg-url">BoardGameGeek URL</Label>
            <div className="flex gap-2">
              <Input
                id="bgg-url"
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://boardgamegeek.com/boardgame/..."
                className="flex-1"
              />
              <Button onClick={handleImportFromUrl} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </div>

          {/* Import Options */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Import Options</h4>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Coming Soon */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-coming-soon"
                  checked={importAsComingSoon}
                  onCheckedChange={(checked) => setImportAsComingSoon(checked === true)}
                />
                <Label htmlFor="import-coming-soon" className="text-sm">
                  Coming Soon
                </Label>
              </div>

              {/* For Sale */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-for-sale"
                  checked={importAsForSale}
                  onCheckedChange={(checked) => {
                    setImportAsForSale(checked === true);
                    if (checked) setShowSaleDialog(true);
                  }}
                />
                <Label htmlFor="import-for-sale" className="text-sm">
                  For Sale
                </Label>
              </div>

              {/* Expansion */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-expansion"
                  checked={importAsExpansion}
                  onCheckedChange={(checked) => setImportAsExpansion(checked === true)}
                />
                <Label htmlFor="import-expansion" className="text-sm">
                  Expansion
                </Label>
              </div>

              {/* Component Options */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-sleeved"
                  checked={importSleeved}
                  onCheckedChange={(checked) => setImportSleeved(checked === true)}
                />
                <Label htmlFor="import-sleeved" className="text-sm">
                  Sleeved
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-upgraded"
                  checked={importUpgradedComponents}
                  onCheckedChange={(checked) => setImportUpgradedComponents(checked === true)}
                />
                <Label htmlFor="import-upgraded" className="text-sm">
                  Upgraded Components
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-crowdfunded"
                  checked={importCrowdfunded}
                  onCheckedChange={(checked) => setImportCrowdfunded(checked === true)}
                />
                <Label htmlFor="import-crowdfunded" className="text-sm">
                  Crowdfunded
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="import-inserts"
                  checked={importInserts}
                  onCheckedChange={(checked) => setImportInserts(checked === true)}
                />
                <Label htmlFor="import-inserts" className="text-sm">
                  Has Inserts
                </Label>
              </div>
            </div>

            {/* Parent Game Selection for Expansions */}
            {importAsExpansion && (
              <div className="space-y-2">
                <Label>Base Game</Label>
                <Select
                  value={importParentGameId || ""}
                  onValueChange={setImportParentGameId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select base game" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseGames.map((game) => (
                      <SelectItem key={game.id} value={game.id}>
                        {game.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quick access buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLocationDialog(true)}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Set Location
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPurchaseDialog(true)}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Purchase Details
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaleDialog(true)}
                disabled={!importAsForSale}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Sale Details
              </Button>
            </div>
          </div>

          {/* Last imported game */}
          {lastImportedGameTitle && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 text-primary rounded-lg">
              <Check className="h-4 w-4" />
              <span className="text-sm">
                Last added: <strong>{lastImportedGameTitle}</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Dialog */}
      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              Enter pricing and condition for the game
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sale Price ($)</Label>
              <Input
                type="number"
                value={importSalePrice}
                onChange={(e) => setImportSalePrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={importSaleCondition || ""}
                onValueChange={(v) => setImportSaleCondition(v as SaleCondition)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {SALE_CONDITION_OPTIONS.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {condition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowSaleDialog(false)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storage Location</DialogTitle>
            <DialogDescription>
              Where is this game stored?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Room</Label>
              <Input
                value={importLocationRoom}
                onChange={(e) => setImportLocationRoom(e.target.value)}
                placeholder="e.g., Game Room, Living Room"
              />
            </div>
            <div className="space-y-2">
              <Label>Shelf/Cabinet</Label>
              <Input
                value={importLocationShelf}
                onChange={(e) => setImportLocationShelf(e.target.value)}
                placeholder="e.g., Kallax Shelf 2, Top Cabinet"
              />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Input
                value={importLocationMisc}
                onChange={(e) => setImportLocationMisc(e.target.value)}
                placeholder="e.g., With other party games"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowLocationDialog(false)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Details Dialog (private to library owner) */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
            <DialogDescription>
              Private purchase information (only visible to you)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Purchase Price ($)</Label>
              <Input
                type="number"
                value={importPurchasePrice}
                onChange={(e) => setImportPurchasePrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={importPurchaseDate}
                onChange={(e) => setImportPurchaseDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowPurchaseDialog(false)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
