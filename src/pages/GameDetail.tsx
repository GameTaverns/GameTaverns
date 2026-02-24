import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Edit, ChevronLeft, ChevronRight, DollarSign, Tag, Package, Play, MapPin, ArrowLeftRight } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { SEO, gameJsonLd } from "@/components/seo/SEO";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/layout/Layout";
import { useGame, useGames } from "@/hooks/useGames";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/contexts/DemoContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useTenant } from "@/contexts/TenantContext";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { getOptimalImageUrl, proxiedImageUrl, directImageUrl, isBggImage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ContactSellerForm } from "@/components/games/ContactSellerForm";
import { LogPlayDialog } from "@/components/games/LogPlayDialog";
import { PlayHistory } from "@/components/games/PlayHistory";
import { EloLeaderboard } from "@/components/games/EloLeaderboard";
import { GameImage } from "@/components/games/GameImage";
import { YouTubeVideoList } from "@/components/games/YouTubeEmbed";
import { StarRating } from "@/components/games/StarRating";
import { FavoriteButton } from "@/components/games/FavoriteButton";
import { GameRecommendations } from "@/components/games/GameRecommendations";
import { RequestLoanButton } from "@/components/lending/RequestLoanButton";
import { GameDocuments } from "@/components/games/GameDocuments";
import { PurchaseLinks } from "@/components/catalog/PurchaseLinks";
import { useAddTradeListing, useMyTradeListings, useRemoveTradeListing, type SaleCondition } from "@/hooks/useTrades";
import { useToast } from "@/hooks/use-toast";
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
  const { tenantSlug, library } = useTenant();
  const { user } = useAuth();
  const { data: realGame, isLoading: isRealLoading } = useGame(isDemoMode ? undefined : slug);
  const { data: realGames } = useGames(!isDemoMode);
  const { isAdmin } = useAuth();
  const { isOwner: isLibraryOwner } = useTenant();
  const canViewAdminData = isAdmin || isLibraryOwner;
  const { playLogs, messaging, forSale, ratings, lending } = useFeatureFlags();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [brokenImageUrls, setBrokenImageUrls] = useState<string[]>([]);
  const [useProxyForImage, setUseProxyForImage] = useState<Record<string, boolean>>({});
  
  // Build tenant-aware base URL for links - uses subdomains in production, query params in preview
  const baseFilterUrl = isDemoMode ? "/?demo=true" : tenantSlug ? getLibraryUrl(tenantSlug, "/") : "/";

  // Reset image state when slug changes - must be before early returns
  useEffect(() => {
    setSelectedImageIndex(0);
    setBrokenImageUrls([]);
    setUseProxyForImage({});
  }, [slug]);

  // Helper to get image src - use proxy first for BGG, with fallback
  const getImageSrc = (url: string) => {
    // If we've already tried proxy and it failed, try direct
    if (useProxyForImage[url] === false) return directImageUrl(url);
    // For BGG images, always start with proxy (bypasses hotlink protection)
    if (isBggImage(url)) return proxiedImageUrl(url);
    // For other images, use direct URL
    return directImageUrl(url);
  };

  // Handle image error with fallback
  const handleImageError = (url: string) => {
    if (!url) return;
    if (useProxyForImage[url] === undefined && isBggImage(url)) {
      // Proxy failed for BGG image, try direct as fallback
      setUseProxyForImage(prev => ({ ...prev, [url]: false }));
    } else if (useProxyForImage[url] === undefined && !isBggImage(url)) {
      // Direct failed for non-BGG image, try proxy as fallback
      setUseProxyForImage(prev => ({ ...prev, [url]: true }));
    } else {
      // Both failed, mark as broken
      setBrokenImageUrls(prev => prev.includes(url) ? prev : [...prev, url]);
    }
  };

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

  // Fetch catalog additional_images when library game has none but has a catalog_id
  const catalogId = (game as any)?.catalog_id as string | undefined;
  const gameHasImages = (game?.additional_images?.length ?? 0) > 0;
  const { data: catalogImages } = useQuery({
    queryKey: ["catalog-images", catalogId],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_catalog")
        .select("additional_images")
        .eq("id", catalogId!)
        .single();
      return data?.additional_images ?? [];
    },
    enabled: !!catalogId && !gameHasImages && !isDemoMode,
  });


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
          <Button onClick={() => navigate(baseFilterUrl)}>Back to Collection</Button>
        </div>
      </Layout>
    );
  }

  const sanitizeImageUrl = (url: string): string | null => {
    if (!url) return null;

    // Clean up malformed URLs from scraping - strip trailing HTML entities and junk
    let cleanUrl = url
      .replace(/&quot;.*$/i, "")
      .replace(/["');}\s]+$/g, "")
      .trim();

    if (!cleanUrl) return null;

    let parsed: URL;
    try {
      parsed = new URL(cleanUrl);
    } catch {
      return null;
    }

    // Only allow http(s)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

    // Must look like an image URL (extension OR BGG /pic path)
    const path = parsed.pathname.toLowerCase();
    const looksLikeImage = /\.(jpg|jpeg|png|webp)$/i.test(path) || path.includes("/pic");
    if (!looksLikeImage) return null;

    return parsed.toString();
  };

  // Images: show multiple images.
  // Filter out genuinely low-quality BGG variant types that are tiny crops/thumbnails.
  // __itemheader and __opengraph are wide format images useful as gallery shots — keep them.
  // __square, __geeklistimagebar, __geeklistimage, __mt are small thumbnails/crops — skip.
  const LOW_QUALITY_BGG_VARIANTS = /__(geeklistimagebar|geeklistimage|square|mt|geeklistimagebar@2x|geeklistimage@2x)|__square@2x/i;

  // Merge library images with catalog fallback images
  const mergedAdditionalImages = (game.additional_images?.length ?? 0) > 0
    ? game.additional_images!
    : (catalogImages ?? []);

  const allImages = Array.from(
    new Set(
      [game.image_url, ...mergedAdditionalImages]
        .filter((u): u is string => typeof u === "string" && !!u)
        .map((u) =>
          // reuse the shared URL cleaning logic (handles &quot; junk, trailing punctuation, etc.)
          directImageUrl(u) ?? u
        )
        // Filter out known low-quality BGG variant types that tend to fail via proxy
        .filter((u) => !LOW_QUALITY_BGG_VARIANTS.test(u))
        .filter((u) => !brokenImageUrls.includes(u))
    )
  ).slice(0, 10);

  // Debug: log what we receive from database
  console.log("[GameDetail] Raw image data:", {
    image_url: game.image_url,
    additional_images: game.additional_images,
    allImages,
  });

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
            <>
              <hr className="border-border my-6" />
              <h2 className="font-display text-xl font-semibold text-foreground mt-0 mb-3">
                {children}
              </h2>
            </>
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

  const gamePageUrl = `${window.location.origin}${window.location.pathname}`;
  const gameDesc = game.description
    ? game.description.replace(/(<([^>]+)>)/gi, "").slice(0, 155)
    : `${game.title} — ${playerRange} players${game.play_time ? `, ${game.play_time}` : ""}. Part of the ${library?.name ?? "GameTaverns"} board game library.`;

  return (
    <Layout>
      <SEO
        title={`${game.title}${library ? ` — ${library.name}` : ""}`}
        description={gameDesc}
        ogImage={game.image_url ?? undefined}
        ogType="article"
        canonical={gamePageUrl}
        jsonLd={gameJsonLd({
          name: game.title,
          description: game.description,
          imageUrl: game.image_url,
          url: gamePageUrl,
          minPlayers: game.min_players,
          maxPlayers: game.max_players,
          playTime: game.play_time,
        })}
      />
      <div className="max-w-6xl mx-auto overflow-x-hidden">
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
            {/* Main Image - short aspect ratio on mobile, square on desktop, hard max-h safety */}
            <div className="aspect-[4/3] sm:aspect-[4/3] sm:max-h-[50vh] lg:aspect-square lg:max-h-none overflow-hidden rounded-lg bg-muted card-elevated relative group w-full mx-auto lg:max-w-none">
              {allImages.length > 0 ? (
                <>
                  {(() => {
                    const safeIndex = Math.min(
                      selectedImageIndex,
                      Math.max(0, allImages.length - 1)
                    );
                    const selectedUrl = allImages[safeIndex];

                    return (
                       <GameImage
                         imageUrl={selectedUrl}
                         alt={game.title}
                         loading="eager"
                         priority={true}
                         className="h-full w-full object-cover"
                         fallback={
                           <div className="flex h-full items-center justify-center bg-muted">
                             <span className="text-8xl text-muted-foreground/50">🎲</span>
                           </div>
                         }
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
              <div className="flex gap-2 overflow-x-auto pb-2 max-w-full">
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
                       <GameImage
                         imageUrl={img}
                         alt={`${game.title} - Image ${idx + 1}`}
                         loading="lazy"
                         className="h-full w-full object-cover bg-muted"
                         fallback={
                           <div className="flex h-full items-center justify-center bg-muted">
                             <span className="text-2xl text-muted-foreground/50">🎲</span>
                           </div>
                         }
                       />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="min-w-0 overflow-hidden max-w-[calc(100vw-2rem)]">
            {/* Title with Actions */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                {game.title}
              </h1>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Favorite Button - visible to library owners */}
                <FavoriteButton gameId={game.id} />
                {/* Mark for Trade Button - visible to authenticated library owners */}
                {isLibraryOwner && !isDemoMode && library && (
                  <MarkForTradeButton gameId={game.id} gameTitle={game.title} libraryId={library.id} />
                )}
                {/* Request Loan Button - visible when lending is enabled */}
                {lending && library && library.owner_id && !isDemoMode && (
                  <RequestLoanButton
                    gameId={game.id}
                    gameTitle={game.title}
                    gameImageUrl={game.image_url}
                    libraryId={library.id}
                    lenderUserId={library.owner_id}
                  />
                )}
                {canViewAdminData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(tenantSlug ? getLibraryUrl(tenantSlug, `/edit/${game.slug || game.id}`) : `/edit/${game.slug || game.id}`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Star Rating - interactive on detail page */}
            {ratings && (
              <div className="mb-4">
                <StarRating gameId={game.id} size="md" showCount={true} interactive={true} />
              </div>
            )}

            {/* For Sale Banner */}
            {forSale && game.is_for_sale && (
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
            <div className="flex flex-wrap gap-2 mb-6 max-w-[calc(100vw-2rem)] overflow-hidden">
              {allCategories.map((cat, idx) => {
                const filterParams = new URLSearchParams();
                filterParams.set("filter", cat.type);
                filterParams.set("value", cat.label);
                if (isDemoMode) filterParams.set("demo", "true");
                else if (tenantSlug) filterParams.set("tenant", tenantSlug);
                
                return (
                  <Link key={idx} to={`/?${filterParams.toString()}`}>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-sm"
                    >
                      {cat.label}
                    </Badge>
                  </Link>
                );
              })}
            </div>

            {/* BGG Link + Purchase Links */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-6">
              {game.bgg_url && (
                <a
                  href={game.bgg_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on BoardGameGeek
                </a>
              )}
              {(game as any).catalog_id && (
                <PurchaseLinks catalogId={(game as any).catalog_id} />
              )}
            </div>

            {/* Tabs for Description and Additional Info */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full h-auto flex-wrap gap-1 p-1 mb-4 max-w-[calc(100vw-2rem)] overflow-x-auto">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                {playLogs && <TabsTrigger value="plays">Play History</TabsTrigger>}
                {!isDemoMode && library && <TabsTrigger value="documents">Documents</TabsTrigger>}
              </TabsList>

              <TabsContent value="description" className="mt-0">
                <div className="prose prose-sm max-w-none">
                  <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                    Description
                  </h2>
                  <DescriptionContent content={game.description} />
                </div>
                
                {/* Gameplay Videos Section - inside description tab */}
                {game.youtube_videos && game.youtube_videos.length > 0 && (
                  <>
                    <hr className="my-8 border-border" />
                    <YouTubeVideoList videos={game.youtube_videos} title="Gameplay Videos" />
                  </>
                )}
              </TabsContent>

              <TabsContent value="info" className="mt-0">
                <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                  Additional Information
                </h2>
                <div className="overflow-x-auto max-w-full">
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
                    {(game as any).designers?.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Designer{(game as any).designers.length > 1 ? 's' : ''}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {(game as any).designers.map((d: any) => d.name).join(", ")}
                        </TableCell>
                      </TableRow>
                    )}
                    {(game as any).artists?.length > 0 && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Artist{(game as any).artists.length > 1 ? 's' : ''}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {(game as any).artists.map((a: any) => a.name).join(", ")}
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
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Copies Owned
                      </TableCell>
                      <TableCell className="text-foreground">
                        {(game as any).copies_owned ?? 1}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Sleeved
                      </TableCell>
                      <TableCell className="text-foreground">
                        {game.sleeved ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Upgraded Components
                      </TableCell>
                      <TableCell className="text-foreground">
                        {game.upgraded_components ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Crowdfunded
                      </TableCell>
                      <TableCell className="text-foreground">
                        {game.crowdfunded ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">
                        Inserts
                      </TableCell>
                      <TableCell className="text-foreground">
                        {game.inserts ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                    {game.is_expansion && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">
                          Stored In
                        </TableCell>
                        <TableCell className="text-foreground">
                          {game.in_base_game_box ? "Base game box" : "Separate box"}
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Admin/Owner-only purchase info */}
                    {canViewAdminData && (game.admin_data?.purchase_price || game.admin_data?.purchase_date || (game.admin_data as any)?.current_value) && (
                      <>
                        {game.admin_data?.purchase_price && (
                          <TableRow className="bg-amber-500/5">
                            <TableCell className="font-medium text-amber-700 dark:text-amber-400">
                              Purchase Price
                            </TableCell>
                            <TableCell className="text-amber-700 dark:text-amber-400">
                              ${game.admin_data.purchase_price.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        )}
                        {game.admin_data?.purchase_date && (
                          <TableRow className="bg-amber-500/5">
                            <TableCell className="font-medium text-amber-700 dark:text-amber-400">
                              Purchase Date
                            </TableCell>
                            <TableCell className="text-amber-700 dark:text-amber-400">
                              {new Date(game.admin_data.purchase_date).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        )}
                        {(game.admin_data as any)?.current_value && (
                          <TableRow className="bg-amber-500/5">
                            <TableCell className="font-medium text-amber-700 dark:text-amber-400">
                              Current Value
                            </TableCell>
                            <TableCell className="text-amber-700 dark:text-amber-400">
                              ${(game.admin_data as any).current_value.toFixed(2)}
                              {game.admin_data?.purchase_price && (
                                <span className={`ml-2 text-xs font-medium ${(game.admin_data as any).current_value >= game.admin_data.purchase_price ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  ({(game.admin_data as any).current_value >= game.admin_data.purchase_price ? '+' : ''}
                                  {(((game.admin_data as any).current_value - game.admin_data.purchase_price) / game.admin_data.purchase_price * 100).toFixed(0)}%)
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
                </div>
              </TabsContent>

              <TabsContent value="location" className="mt-0">
                <h2 className="font-display text-xl font-semibold mb-4 text-foreground">
                  Storage Location
                </h2>
                {(game.location_room || game.location_shelf || game.location_misc) ? (
                  <Table>
                    <TableBody>
                      {game.location_room && (
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              Room
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">
                            {game.location_room}
                          </TableCell>
                        </TableRow>
                      )}
                      {game.location_shelf && (
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            Shelf
                          </TableCell>
                          <TableCell className="text-foreground">
                            {game.location_shelf}
                          </TableCell>
                        </TableRow>
                      )}
                      {game.location_misc && (
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground">
                            Notes
                          </TableCell>
                          <TableCell className="text-foreground">
                            {game.location_misc}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground italic">
                    No location set for this game.
                  </p>
                )}
              </TabsContent>

              {playLogs && (
                <TabsContent value="plays" className="mt-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      Play History
                    </h2>
                    <LogPlayDialog gameId={game.id} gameTitle={game.title}>
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Log Play
                      </Button>
                    </LogPlayDialog>
                  </div>
                  <PlayHistory gameId={game.id} />
                  
                  {/* ELO Leaderboard */}
                  <div className="mt-8 pt-6 border-t">
                    <EloLeaderboard gameId={game.id} gameTitle={game.title} />
                  </div>
                </TabsContent>
              )}

              {!isDemoMode && library && (
                <TabsContent value="documents" className="mt-0">
                  <GameDocuments
                    gameId={game.id}
                    libraryId={library.id}
                    catalogId={(game as any).catalog_id ?? null}
                    canManage={!!isLibraryOwner}
                  />
                </TabsContent>
              )}
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
                          <GameImage
                            imageUrl={expansion.image_url}
                            alt={expansion.title}
                            className="h-full w-full object-contain bg-muted group-hover:scale-105 transition-transform duration-300"
                            fallback={
                              <div className="h-full w-full flex items-center justify-center bg-muted">
                                <Package className="h-8 w-8 text-muted-foreground" />
                              </div>
                            }
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        {forSale && expansion.is_for_sale && (
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

        {/* AI-Powered Recommendations */}
        <GameRecommendations gameId={game.id} gameTitle={game.title} />

        {/* Contact Seller Form - Only show for games that are for sale when messaging is enabled */}
        {messaging && forSale && game.is_for_sale && (
          <div className="mt-12 max-w-md">
            <ContactSellerForm gameId={game.id} gameTitle={game.title} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GameDetail;

// Inline component for marking a game for trade from the detail page
function MarkForTradeButton({ gameId, gameTitle, libraryId }: { gameId: string; gameTitle: string; libraryId: string }) {
  const { data: listings } = useMyTradeListings();
  const addListing = useAddTradeListing();
  const removeListing = useRemoveTradeListing();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [condition, setCondition] = useState<SaleCondition>("Like New");
  const [localOnly, setLocalOnly] = useState(false);
  const [willingToShip, setWillingToShip] = useState(false);

  const existingListing = listings?.find((l) => l.game_id === gameId);
  const isListed = !!existingListing;

  const handleRemove = async () => {
    if (!existingListing) return;
    try {
      await removeListing.mutateAsync(existingListing.id);
      toast({ title: "Removed from trade list" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    try {
      await addListing.mutateAsync({
        game_id: gameId,
        library_id: libraryId,
        condition,
        willing_to_ship: willingToShip,
        local_only: localOnly,
      });
      toast({ title: `${gameTitle} marked for trade` });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isListed) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={handleRemove}
        disabled={removeListing.isPending}
        title="Remove from trade list"
      >
        <ArrowLeftRight className="h-4 w-4 mr-2" />
        Listed for Trade
      </Button>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Mark for trade">
          <ArrowLeftRight className="h-4 w-4 mr-2" />
          Mark for Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>List "{gameTitle}" for Trade</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as SaleCondition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Like New">Like New</SelectItem>
                <SelectItem value="Very Good">Very Good</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Acceptable">Acceptable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="willingToShip" checked={willingToShip} onChange={(e) => setWillingToShip(e.target.checked)} className="rounded" />
            <Label htmlFor="willingToShip">Willing to ship</Label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="localOnly" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)} className="rounded" />
            <Label htmlFor="localOnly">Local pickup only</Label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={addListing.isPending}>List for Trade</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}