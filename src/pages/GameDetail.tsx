import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Edit, ChevronLeft, ChevronRight, DollarSign, Tag, Package, Play } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/layout/Layout";
import { useGame, useGames } from "@/hooks/useGames";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoContext";
import { directImageUrl, proxiedImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ContactSellerForm } from "@/components/games/ContactSellerForm";
import { FavoriteButton } from "@/components/games/FavoriteButton";
import { LogPlayDialog } from "@/components/games/LogPlayDialog";
import { PlayHistory } from "@/components/games/PlayHistory";
import { GameImage } from "@/components/games/GameImage";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

const GameDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDemoMode, demoGames } = useDemoMode();

  const { data: realGame, isLoading: isRealLoading } = useGame(isDemoMode ? undefined : slug);
  const { data: realGames } = useGames(!isDemoMode);
  const { isAdmin } = useAuth();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [brokenImageUrls, setBrokenImageUrls] = useState<string[]>([]);

  // Reset image state when game changes - must be before early returns
  useEffect(() => {
    setSelectedImageIndex(0);
    setBrokenImageUrls([]);
  }, [game?.id]);

  // Build demo base games + expansions grouping (matches real data shape)
  const demoBaseGames = useMemo(() => {
    if (!isDemoMode) return [];

    const all = [...demoGames].map((g) => ({ ...g, expansions: [] as any[] }));
    const base: any[] = [];
    const expansionMap = new Map<string, any[]>();

    all.forEach((g: any) => {
      if (g.is_expansion && g.parent_game_id) {
        const list = expansionMap.get(g.parent_game_id) || [];
        list.push(g);
        expansionMap.set(g.parent_game_id, list);
      } else {
        base.push(g);
      }
    });

    base.forEach((g: any) => {
      g.expansions = expansionMap.get(g.id) || [];
    });

    return base;
  }, [demoGames, isDemoMode]);

  const demoGame = useMemo(() => {
    if (!isDemoMode || !slug) return null;
    // Match by slug first, then id
    return demoGames.find((g) => g.slug === slug) || demoGames.find((g) => g.id === slug) || null;
  }, [demoGames, isDemoMode, slug]);

  const game = isDemoMode ? demoGame : realGame;
  const allGames = isDemoMode ? demoBaseGames : (realGames || []);
  const isLoading = isDemoMode ? false : isRealLoading;

  const basePath = isDemoMode ? "/demo/game" : "/game";
  const editPath = isDemoMode ? `/demo/edit/${game?.id}` : `/admin/edit/${game?.id}`;


  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Skeleton className="aspect-square rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="w-20 h-20 rounded" />
                <Skeleton className="w-20 h-20 rounded" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!game) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">🎲</span>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
            Game not found
          </h2>
          <p className="text-muted-foreground mb-4">
            The game you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate("/")}>Back to Collection</Button>
        </div>
      </Layout>
    );
  }

  const sanitizeImageUrl = (url: string): string | null => {
    // Reject obviously corrupted strings from scraping (HTML entities, trailing junk)
    if (!url || url.includes("&quot;") || url.includes(";") || url.includes(" ")) return null;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    // Only allow known-safe image hosts
    const allowedHosts = new Set(["cf.geekdo-images.com", "boardgamegeek.com", "www.boardgamegeek.com"]);
    if (!allowedHosts.has(parsed.hostname)) return null;

    const path = parsed.pathname.toLowerCase();

    // Exclude images that are almost always generic/irrelevant
    const blockedPathFragments = [
      "geeklist",
      "geeklistimagebar",
      "opengraph",
      "thumb",
      "avatar",
      "icon",
      "logo",
    ];
    if (blockedPathFragments.some((frag) => path.includes(frag))) return null;

    // Must look like an actual image
    const looksLikeImage = /\.(jpg|jpeg|png|webp)$/i.test(path) || path.includes("/pic");
    if (!looksLikeImage) return null;

    return parsed.toString();
  };

  // Images: show multiple images, but aggressively filter out broken/irrelevant ones
  const allImages = Array.from(
    new Set(
      [game.image_url, ...(game.additional_images || [])]
        .filter((u): u is string => typeof u === "string" && !!u)
        .map((u) => sanitizeImageUrl(u))
        .filter((u): u is string => !!u)
        .filter((u) => !brokenImageUrls.includes(u))
    )
  ).slice(0, 10);

  const playerRange =
    game.min_players === game.max_players
      ? `${game.min_players} player${game.min_players !== 1 ? "s" : ""}`
      : `${game.min_players}-${game.max_players}`;

  const allCategories = [
    game.difficulty && { label: game.difficulty, type: "difficulty" },
    game.play_time && { label: game.play_time, type: "playtime" },
    game.game_type && { label: game.game_type, type: "type" },
    ...game.mechanics.map((m) => ({ label: m.name, type: "mechanic" })),
    game.publisher && { label: game.publisher.name, type: "publisher" },
  ].filter(Boolean) as { label: string; type: string }[];

  // Get expansions for this game from allGames (since useGame doesn't include expansion grouping)
  const currentGameWithExpansions = allGames?.find((g) => g.id === game.id);
  const expansions = currentGameWithExpansions?.expansions || [];

  // Render markdown description with proper styling
  const DescriptionContent = ({ content }: { content: string | null }) => {
    if (!content) {
      return <p className="text-muted-foreground italic">No description available.</p>;
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="font-display text-xl font-semibold text-foreground mt-6 mb-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-lg font-semibold text-foreground mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-muted-foreground leading-relaxed mb-4">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-4 ml-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery Section */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square overflow-hidden rounded-lg bg-muted card-elevated relative group">
              {allImages.length > 0 ? (
                <>
                  {(() => {
                    const safeIndex = Math.min(
                      selectedImageIndex,
                      Math.max(0, allImages.length - 1)
                    );
                    const selectedUrl = allImages[safeIndex];

                    return (
                                      <img
                                        src={directImageUrl(selectedUrl)}
                        alt={game.title}
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          if (!selectedUrl) return;
                          setBrokenImageUrls((prev) =>
                            prev.includes(selectedUrl) ? prev : [...prev, selectedUrl]
                          );
                        }}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    );
                  })()}
                  {/* Navigation arrows for multiple images */}
                  {allImages.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedImageIndex((prev) => 
                          prev === 0 ? allImages.length - 1 : prev - 1
                        )}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedImageIndex((prev) => 
                          prev === allImages.length - 1 ? 0 : prev + 1
                        )}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <span className="sr-only">{game.title}</span>
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-muted">
                  <span className="text-8xl text-muted-foreground/50">🎲</span>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 overflow-hidden rounded-lg border-2 transition-all ${
                      selectedImageIndex === idx
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                   >
                                      <img
                                        src={directImageUrl(img)}
                        alt={`${game.title} - Image ${idx + 1}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          setBrokenImageUrls((prev) =>
                            prev.includes(img) ? prev : [...prev, img]
                          );
                        }}
                        className="h-full w-full object-contain bg-muted"
                      />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Section */}
          <div>
            {/* Title with Actions */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
                {game.title}
              </h1>
              <div className="flex items-center gap-2 flex-shrink-0">
                <FavoriteButton gameId={game.id} />
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/edit/${game.id}`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* For Sale Banner */}
            {game.is_for_sale && (
              <Card className="mb-6 border-green-500/30 bg-green-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/20">
                        <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-300">
                          {game.sale_price ? `$${game.sale_price.toFixed(2)}` : 'For Sale'}
                        </p>
                        {game.sale_condition && (
                          <p className="text-sm text-green-600/80 dark:text-green-400/80 flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Condition: {game.sale_condition}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Categories as clickable badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {allCategories.map((cat, idx) => (
                <Link
                  key={idx}
                  to={`/?filter=${cat.type}&value=${encodeURIComponent(cat.label)}`}
                >
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-sm"
                  >
                    {cat.label}
                  </Badge>
                </Link>
              ))}
            </div>

            {/* BGG Link */}
            {game.bgg_url && (
              <a
                href={game.bgg_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mb-6 text-sm text-primary hover:underline font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                View on BoardGameGeek
              </a>
            )}

            {/* Tabs for Description and Additional Info */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="plays">Play History</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-0">
                <div className="prose prose-sm max-w-none">
                  <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                    Description
                  </h2>
                  <DescriptionContent content={game.description} />
                </div>
              </TabsContent>

              <TabsContent value="info" className="mt-0">
                <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                  Additional Information
                </h2>
                <Table>
                  <TableBody>
                    {game.play_time && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Play Time
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.play_time}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Number of Players
                      </TableCell>
                      <TableCell className="text-foreground">
                        {playerRange}
                      </TableCell>
                    </TableRow>
                    {game.suggested_age && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Suggested Age
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.suggested_age}
                        </TableCell>
                      </TableRow>
                    )}
                    {game.difficulty && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Difficulty
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.difficulty}
                        </TableCell>
                      </TableRow>
                    )}
                    {game.game_type && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Game Type
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.game_type}
                        </TableCell>
                      </TableRow>
                    )}
                    {game.publisher && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Publisher
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.publisher.name}
                        </TableCell>
                      </TableRow>
                    )}
                    {game.mechanics.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Mechanics
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.mechanics.map((m) => m.name).join(", ")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="plays" className="mt-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Play History
                  </h2>
                  {isAdmin && (
                    <LogPlayDialog gameId={game.id} gameTitle={game.title}>
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Log Play
                      </Button>
                    </LogPlayDialog>
                  )}
                </div>
                <PlayHistory gameId={game.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Expansions Section */}
        {expansions.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center gap-2 mb-6">
              <Package className="h-6 w-6 text-primary" />
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Expansions ({expansions.length})
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {expansions.map((expansion) => (
                <Link
                  key={expansion.id}
                  to={`/game/${expansion.slug || expansion.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow border-primary/20">
                    <CardContent className="p-0">
                      <div className="aspect-square overflow-hidden relative">
                        {expansion.image_url ? (
                          <img
                            src={proxiedImageUrl(expansion.image_url)}
                            alt={expansion.title}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-contain bg-muted group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        {expansion.is_for_sale && (
                          <Badge className="absolute top-2 right-2 text-xs bg-green-500/90 text-white border-0">
                            ${expansion.sale_price}
                          </Badge>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {expansion.title}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Games Section */}
        {relatedGames && relatedGames.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-2xl font-semibold mb-6 text-foreground">
              Related Games
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedGames.map((relatedGame) => (
                <Link
                  key={relatedGame.id}
                  to={`/game/${relatedGame.slug || relatedGame.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="aspect-square overflow-hidden bg-muted">
                        {relatedGame.image_url ? (
                          <GameImage
                            imageUrl={relatedGame.image_url}
                            alt={relatedGame.title}
                            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <span className="text-4xl">🎲</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {relatedGame.title}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Contact Seller Form - Only show for games that are for sale */}
        {game.is_for_sale && (
          <div className="mt-12 max-w-md">
            <ContactSellerForm gameId={game.id} gameTitle={game.title} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GameDetail;