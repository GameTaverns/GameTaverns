import { useState } from "react";
import { useCollectionValue, useUpdateGameValue, type GameValueData } from "@/hooks/useCollectionValue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GameImage } from "@/components/games/GameImage";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Edit2, 
  Package,
  PiggyBank 
} from "lucide-react";

interface CollectionValueDashboardProps {
  libraryId: string;
}

export function CollectionValueDashboard({ libraryId }: CollectionValueDashboardProps) {
  const { data, isLoading, error } = useCollectionValue(libraryId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Unable to load collection value data. Make sure you have games in your library.
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, games } = data;
  const isPositiveChange = summary.valueChange >= 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 text-center">
            <PiggyBank className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold text-foreground">${summary.totalPurchaseValue.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Total Invested</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold text-foreground">${summary.totalCurrentValue.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Current Value</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 text-center">
            {isPositiveChange ? (
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
            ) : (
              <TrendingDown className="h-6 w-6 mx-auto mb-2 text-destructive" />
            )}
            <div className={`text-2xl font-bold ${isPositiveChange ? "text-primary" : "text-destructive"}`}>
              {isPositiveChange ? "+" : ""}${summary.valueChange.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {isPositiveChange ? "+" : ""}{summary.valueChangePercent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/60">
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold text-foreground">{summary.gamesWithValues}</div>
            <div className="text-xs text-muted-foreground">of {summary.totalGames} valued</div>
          </CardContent>
        </Card>
      </div>

      {/* Games with Values */}
      <Card>
        <CardHeader>
          <CardTitle>Game Values</CardTitle>
          <CardDescription>Track purchase price and current market value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {games.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No games in collection</p>
            ) : (
              games.map((game) => (
                <GameValueRow key={game.gameId} game={game} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GameValueRow({ game }: { game: GameValueData }) {
  const [open, setOpen] = useState(false);
  const [currentValue, setCurrentValue] = useState(game.currentValue?.toString() || "");
  const [purchasePrice, setPurchasePrice] = useState(game.purchasePrice?.toString() || "");
  const updateValue = useUpdateGameValue();
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await updateValue.mutateAsync({
        gameId: game.gameId,
        currentValue: currentValue ? parseFloat(currentValue) : null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      });
      toast({ title: "Value updated" });
      setOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const hasValue = game.currentValue || game.purchasePrice;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
        {game.imageUrl ? (
          <GameImage imageUrl={game.imageUrl} alt={game.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm">{game.title}</div>
        {hasValue ? (
          <div className="text-xs text-muted-foreground">
            {game.purchasePrice && <span>Paid: ${game.purchasePrice}</span>}
            {game.purchasePrice && game.currentValue && <span className="mx-1">→</span>}
            {game.currentValue && <span className="text-foreground">Now: ${game.currentValue}</span>}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No value set</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Value: {game.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="purchase">Purchase Price ($)</Label>
              <Input
                id="purchase"
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current">Current Value ($)</Label>
              <Input
                id="current"
                type="number"
                step="0.01"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {game.bggMarketPrice && (
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground">BGG Market Reference</div>
                <div className="font-medium">${game.bggMarketPrice}</div>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => setCurrentValue(game.bggMarketPrice!.toString())}
                >
                  Use this value
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateValue.isPending}>
              {updateValue.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {game.currentValue && game.purchasePrice && (
        <Badge 
          variant={game.currentValue >= game.purchasePrice ? "default" : "destructive"}
          className="text-xs"
        >
          {game.currentValue >= game.purchasePrice ? "+" : ""}
          {((game.currentValue - game.purchasePrice) / game.purchasePrice * 100).toFixed(0)}%
        </Badge>
      )}
    </div>
  );
}
