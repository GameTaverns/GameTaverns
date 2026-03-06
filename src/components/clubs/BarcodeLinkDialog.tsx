import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, Loader2, Package } from "lucide-react";
import { useClubGameSearch } from "@/hooks/useClubs";
import { useSaveBarcode } from "@/hooks/useBarcodeScanner";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";

interface BarcodeLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barcode: string;
  clubId: string;
  userId: string;
  /** Called after linking with the matched game */
  onLinked: (game: any) => void;
}

/**
 * When a barcode isn't recognized, this dialog lets staff search for the game
 * and create the barcode → game mapping for future instant lookups.
 */
export function BarcodeLinkDialog({
  open,
  onOpenChange,
  barcode,
  clubId,
  userId,
  onLinked,
}: BarcodeLinkDialogProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { data: results = [], isLoading } = useClubGameSearch(clubId, debouncedSearch);
  const saveBarcode = useSaveBarcode();
  const { toast } = useToast();

  const handleLink = async (game: any) => {
    try {
      await saveBarcode.mutateAsync({
        barcode,
        barcode_type: barcode.length === 13 ? "EAN-13" : "UPC-A",
        game_id: game.id,
        created_by: userId,
      });
      toast({
        title: "Barcode linked!",
        description: `${barcode} → ${game.title}. Future scans will find it instantly.`,
      });
      onLinked(game);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Link failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Barcode to Game
          </DialogTitle>
          <DialogDescription>
            Barcode <Badge variant="secondary" className="font-mono mx-1">{barcode}</Badge> isn't recognized yet.
            Search for the game to link it for future scans.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for the game..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-border bg-muted/20 p-1 min-h-[100px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : debouncedSearch && results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No games found
              </p>
            ) : !debouncedSearch ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Type to search your club's game catalog
              </p>
            ) : (
              results.slice(0, 10).map((game: any) => (
                <button
                  key={game.id}
                  className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/50 text-left transition-colors"
                  onClick={() => handleLink(game)}
                  disabled={saveBarcode.isPending}
                >
                  {game.image_url ? (
                    <img
                      src={game.image_url}
                      alt=""
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">
                      {game.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {game.library_name}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 gap-1"
                    disabled={saveBarcode.isPending}
                  >
                    {saveBarcode.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Link
                  </Button>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
