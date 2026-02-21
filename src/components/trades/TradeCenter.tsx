import { useState, useEffect } from "react";
import {
  useMyTradeListings,
  useMyWantList,
  useTradeMatches,
  useTradeOffers,
  useAddTradeListing,
  useRemoveTradeListing,
  useAddWant,
  useRemoveWant,
  useCreateTradeOffer,
  useRespondToTradeOffer,
  type TradeListing,
  type TradeWant,
  type TradeMatch,
  type SaleCondition,
} from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GameImage } from "@/components/games/GameImage";
import {
  ArrowLeftRight,
  Plus,
  Trash2,
  Send,
  Package,
  Heart,
  Sparkles,
  Check,
  X,
} from "lucide-react";

export function TradeCenter() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to access the Trade Center</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trade Center</h1>
        <p className="text-muted-foreground">Trade games with other library members</p>
      </div>

      <Tabs defaultValue="matches" className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="matches">
            <Sparkles className="h-4 w-4 mr-1" />
            Matches
          </TabsTrigger>
          <TabsTrigger value="for-trade">
            <Package className="h-4 w-4 mr-1" />
            For Trade
          </TabsTrigger>
          <TabsTrigger value="wants">
            <Heart className="h-4 w-4 mr-1" />
            Want List
          </TabsTrigger>
          <TabsTrigger value="offers">
            <Send className="h-4 w-4 mr-1" />
            Offers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="mt-4">
          <MatchesTab />
        </TabsContent>

        <TabsContent value="for-trade" className="mt-4">
          <ForTradeTab />
        </TabsContent>

        <TabsContent value="wants" className="mt-4">
          <WantListTab />
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          <OffersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchesTab() {
  const { data: matches, isLoading, error } = useTradeMatches();
  const createOffer = useCreateTradeOffer();
  const { toast } = useToast();

  const handleOffer = async (match: TradeMatch) => {
    try {
      await createOffer.mutateAsync({
        receiving_user_id: match.listing_user_id,
        offering_listing_id: match.listing_id,
        message: `I'm interested in trading for ${match.want_title}`,
      });
      toast({ title: "Offer sent!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Trade matching requires self-hosted deployment.
        </CardContent>
      </Card>
    );
  }

  if (!matches?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No matches yet</p>
          <p className="text-sm text-muted-foreground">
            Add games to your want list and we'll find traders
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <Card key={`${match.want_id}-${match.listing_id}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{match.want_title}</div>
                <div className="text-sm text-muted-foreground">
                  Available from {match.listing_user_name || "Unknown"} •{" "}
                  <Badge variant="outline" className="text-xs">
                    {match.listing_condition}
                  </Badge>
                </div>
                {match.listing_notes && (
                  <div className="text-xs text-muted-foreground mt-1">{match.listing_notes}</div>
                )}
              </div>
              <Button size="sm" onClick={() => handleOffer(match)} disabled={createOffer.isPending}>
                <Send className="h-4 w-4 mr-1" />
                Offer
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ForTradeTab() {
  const { data: listings, isLoading } = useMyTradeListings();
  const removeListing = useRemoveTradeListing();
  const { toast } = useToast();

  const handleRemove = async (id: string) => {
    try {
      await removeListing.mutateAsync(id);
      toast({ title: "Removed from trade list" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Games For Trade</CardTitle>
          <CardDescription>
            Games you're willing to trade. Add games from your collection's game detail page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!listings?.length ? (
            <p className="text-center text-muted-foreground py-4">
              No games listed for trade yet
            </p>
          ) : (
            <div className="space-y-2">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-muted">
                    {listing.game?.image_url && (
                      <GameImage
                        imageUrl={listing.game.image_url}
                        alt={listing.game.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{listing.game?.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs mr-2">
                        {listing.condition}
                      </Badge>
                      {listing.willing_to_ship && "Ships"}
                      {listing.local_only && "Local only"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemove(listing.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WantListTab() {
  const { data: wants, isLoading } = useMyWantList();
  const addWant = useAddWant();
  const removeWant = useRemoveWant();
  const [addOpen, setAddOpen] = useState(false);
  const [bggInput, setBggInput] = useState("");
  const [gameTitle, setGameTitle] = useState("");
  const [bggImageUrl, setBggImageUrl] = useState<string | null>(null);
  const [isFetchingBgg, setIsFetchingBgg] = useState(false);
  const { toast } = useToast();

  // Extract BGG ID from either a raw ID or a full URL
  const extractBggId = (input: string): string => {
    const trimmed = input.trim();
    // Match URLs like boardgamegeek.com/boardgame/174430 or /boardgame/174430/gloomhaven
    const urlMatch = trimmed.match(/boardgamegeek\.com\/boardgame\/(\d+)/i);
    if (urlMatch) return urlMatch[1];
    // If it's just digits, use as-is
    if (/^\d+$/.test(trimmed)) return trimmed;
    return "";
  };

  // Auto-fetch game info from BGG via backend edge function (direct browser calls get 401)
  const handleBggInputBlur = async () => {
    const id = extractBggId(bggInput);
    if (!id) return;
    setIsFetchingBgg(true);
    setBggImageUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("bgg-lookup", {
        body: { bgg_id: id, use_ai: false },
      });
      if (!error && data?.success && data.data) {
        if (data.data.title) {
          setGameTitle(data.data.title);
        }
        if (data.data.image_url) {
          setBggImageUrl(data.data.image_url);
        }
      }
    } catch {
      // silently fail - user can type the title manually
    }
    setIsFetchingBgg(false);
  };

  const handleAdd = async () => {
    const id = extractBggId(bggInput);
    if (!id || !gameTitle) return;
    try {
      await addWant.mutateAsync({ bgg_id: id, game_title: gameTitle });
      toast({ title: "Added to want list" });
      setAddOpen(false);
      setBggInput("");
      setGameTitle("");
      setBggImageUrl(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeWant.mutateAsync(id);
      toast({ title: "Removed from want list" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Want
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Want List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bggInput">BGG Link or ID</Label>
                <Input
                  id="bggInput"
                  value={bggInput}
                  onChange={(e) => setBggInput(e.target.value)}
                  onBlur={handleBggInputBlur}
                  placeholder="e.g., https://boardgamegeek.com/boardgame/174430 or 174430"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a BGG link or ID and tab out — title and image auto-fill
                </p>
              </div>
              {bggImageUrl && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                    <GameImage
                      imageUrl={bggImageUrl}
                      alt={gameTitle || "Game preview"}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="flex h-full items-center justify-center bg-muted">
                          <span className="text-2xl text-muted-foreground/50">🎲</span>
                        </div>
                      }
                    />
                  </div>
                  <span className="text-sm font-medium">{gameTitle}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="gameTitle">Game Title</Label>
                <Input
                  id="gameTitle"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  placeholder={isFetchingBgg ? "Fetching from BGG..." : "e.g., Gloomhaven"}
                  disabled={isFetchingBgg}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAdd} disabled={addWant.isPending || !extractBggId(bggInput) || !gameTitle || isFetchingBgg}>
                Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Games You Want</CardTitle>
          <CardDescription>
            We'll match you with traders who have these games
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!wants?.length ? (
            <p className="text-center text-muted-foreground py-4">Your want list is empty</p>
          ) : (
            <div className="space-y-2">
              {wants.map((want) => (
                <div
                  key={want.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                    <BggThumbnail bggId={want.bgg_id} alt={want.game_title} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{want.game_title}</div>
                    <div className="text-xs text-muted-foreground">
                      <a
                        href={`https://boardgamegeek.com/boardgame/${want.bgg_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-primary"
                      >
                        BGG #{want.bgg_id}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemove(want.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Fetches and displays a BGG thumbnail for a game by BGG ID
function BggThumbnail({ bggId, alt }: { bggId: string; alt: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    async function fetchThumb() {
      try {
        const { data, error } = await supabase.functions.invoke("bgg-lookup", {
          body: { bgg_id: bggId, use_ai: false },
        });
        if (!cancelled && !error && data?.success && data.data?.image_url) {
          setImageUrl(data.data.image_url);
        }
      } catch {
        // fail silently
      }
    }
    fetchThumb();
    return () => { cancelled = true; };
  }, [bggId]);

  if (!imageUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <span className="text-lg text-muted-foreground/50">🎲</span>
      </div>
    );
  }

  return (
    <GameImage
      imageUrl={imageUrl}
      alt={alt}
      className="w-full h-full object-cover"
      fallback={
        <div className="flex h-full items-center justify-center bg-muted">
          <span className="text-lg text-muted-foreground/50">🎲</span>
        </div>
      }
    />
  );
}

function OffersTab() {
  const { data: offers, isLoading } = useTradeOffers();
  const respondToOffer = useRespondToTradeOffer();
  const { toast } = useToast();

  const handleRespond = async (offerId: string, status: "accepted" | "declined") => {
    try {
      await respondToOffer.mutateAsync({ offerId, status });
      toast({ title: status === "accepted" ? "Offer accepted!" : "Offer declined" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  const received = offers?.received || [];
  const sent = offers?.sent || [];

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return dateStr; }
  };

  const OfferCard = ({ offer, type }: { offer: any; type: "received" | "sent" }) => {
    const gameTitle = offer.offering_listing?.game?.title || "Unknown game";
    const gameImage = offer.offering_listing?.game?.image_url;
    const condition = offer.offering_listing?.condition;
    const otherUser = type === "received" 
      ? offer.offering_user_profile 
      : offer.receiving_user_profile;
    const otherName = otherUser?.display_name || "Unknown user";

    return (
      <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
        {gameImage && (
          <div className="flex-shrink-0 w-14 h-14 rounded overflow-hidden">
            <GameImage imageUrl={gameImage} alt={gameTitle} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{gameTitle}</div>
              <div className="text-xs text-muted-foreground">
                {type === "received" ? "From" : "To"}: <span className="font-medium">{otherName}</span>
              </div>
              {condition && (
                <div className="text-xs text-muted-foreground">
                  Condition: <span className="font-medium">{condition}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {offer.status === "pending" && type === "received" ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespond(offer.id, "declined")}
                    className="h-7 px-2"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => handleRespond(offer.id, "accepted")} className="h-7 px-2">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Accept
                  </Button>
                </div>
              ) : (
                <Badge variant={
                  offer.status === "accepted" ? "default" 
                  : offer.status === "declined" ? "destructive" 
                  : "secondary"
                }>
                  {offer.status}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">{formatDate(offer.created_at)}</span>
            </div>
          </div>
          {offer.message && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{offer.message}"</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Received Offers
            {received.filter(o => o.status === "pending").length > 0 && (
              <Badge variant="default" className="text-xs">{received.filter(o => o.status === "pending").length} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {received.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No offers received</p>
          ) : (
            <div className="space-y-3">
              {received.map((offer) => (
                <OfferCard key={offer.id} offer={offer} type="received" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sent Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {sent.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No offers sent</p>
          ) : (
            <div className="space-y-3">
              {sent.map((offer) => (
                <OfferCard key={offer.id} offer={offer} type="sent" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
