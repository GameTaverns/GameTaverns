import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2, Library, Dice6, Trophy, Calendar, Star, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import logoImage from "@/assets/logo.png";

interface UserStats {
  gamesOwned: number;
  expansionsOwned: number;
  totalPlays: number;
  uniqueGamesPlayed: number;
  topGames: { title: string; plays: number }[];
  memberSince: string;
  libraryName: string | null;
  displayName: string;
  hIndex: number;
  achievements: number;
}

function useUserStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["share-card-stats", user?.id],
    queryFn: async (): Promise<UserStats | null> => {
      if (!user) return null;

      // Get profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // Get library
      const { data: library } = await supabase
        .from("libraries")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();

      if (!library) {
        return {
          gamesOwned: 0, expansionsOwned: 0, totalPlays: 0, uniqueGamesPlayed: 0,
          topGames: [], memberSince: profile?.created_at || "", libraryName: null,
          displayName: profile?.display_name || "Gamer", hIndex: 0, achievements: 0,
        };
      }

      // Fetch stats in parallel
      const [gamesRes, expansionsRes, sessionsRes, achievementsRes] = await Promise.all([
        supabase.from("games").select("*", { count: "exact", head: true })
          .eq("library_id", library.id).eq("is_expansion", false),
        supabase.from("games").select("*", { count: "exact", head: true })
          .eq("library_id", library.id).eq("is_expansion", true),
        supabase.from("game_sessions").select("game_id, games!inner(title, library_id)")
          .eq("games.library_id", library.id)
          .order("played_at", { ascending: false })
          .limit(500),
        supabase.from("user_achievements").select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      const sessions = sessionsRes.data || [];
      const playCountMap = new Map<string, { title: string; plays: number }>();
      sessions.forEach((s: any) => {
        const title = s.games?.title || "Unknown";
        const existing = playCountMap.get(s.game_id);
        if (existing) existing.plays++;
        else playCountMap.set(s.game_id, { title, plays: 1 });
      });

      const sortedGames = [...playCountMap.values()].sort((a, b) => b.plays - a.plays);

      // H-index
      const playCounts = sortedGames.map(g => g.plays).sort((a, b) => b - a);
      let hIndex = 0;
      for (let i = 0; i < playCounts.length; i++) {
        if (playCounts[i] >= i + 1) hIndex = i + 1;
        else break;
      }

      const uniqueGamesPlayed = playCountMap.size;

      return {
        gamesOwned: gamesRes.count || 0,
        expansionsOwned: expansionsRes.count || 0,
        totalPlays: sessions.length,
        uniqueGamesPlayed,
        topGames: sortedGames.slice(0, 5),
        memberSince: profile?.created_at || "",
        libraryName: library.name,
        displayName: profile?.display_name || "Gamer",
        hIndex,
        achievements: achievementsRes.count || 0,
      };
    },
    enabled: !!user,
  });
}

const CARD_THEMES = [
  { name: "Tavern", bg: "from-amber-900 via-amber-800 to-amber-950", text: "text-amber-50", accent: "text-amber-300" },
  { name: "Night", bg: "from-slate-900 via-indigo-950 to-slate-900", text: "text-slate-100", accent: "text-indigo-300" },
  { name: "Forest", bg: "from-emerald-900 via-emerald-800 to-emerald-950", text: "text-emerald-50", accent: "text-emerald-300" },
  { name: "Royal", bg: "from-purple-900 via-purple-800 to-purple-950", text: "text-purple-50", accent: "text-purple-300" },
];

export default function ShareCard() {
  const { isAuthenticated } = useAuth();
  const { data: stats, isLoading } = useUserStats();
  const cardRef = useRef<HTMLDivElement>(null);
  const [themeIdx, setThemeIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const theme = CARD_THEMES[themeIdx];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = `gametaverns-stats-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Stats card downloaded!");
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      toast.success("Image copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy image — try downloading instead");
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout hideSidebar>
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in to generate your stats card</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <SEO title="Share Your Collection Stats" description="Generate a shareable stats card for your board game collection." />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-2">Your Collection Stats Card</h1>
          <p className="text-muted-foreground">Download and share your board gaming stats on social media, Discord, or anywhere.</p>
        </div>

        {/* Theme selector */}
        <div className="flex gap-2 mb-6">
          {CARD_THEMES.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setThemeIdx(i)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                i === themeIdx
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="w-full aspect-[2/1] rounded-2xl" />
        ) : stats ? (
          <>
            {/* The Card — this is what gets exported */}
            <div
              ref={cardRef}
              className={`bg-gradient-to-br ${theme.bg} rounded-2xl p-8 relative overflow-hidden`}
              style={{ width: "100%", maxWidth: 640, aspectRatio: "640/360" }}
            >
              {/* Decorative dots */}
              <div className="absolute top-4 right-4 grid grid-cols-3 gap-1 opacity-20">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
                ))}
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <img src={logoImage} alt="GameTaverns logo" className="h-7 w-7 opacity-80" />
                <div>
                  <h2 className={`font-display text-lg font-bold ${theme.text}`}>
                    {stats.displayName}
                  </h2>
                  {stats.libraryName && (
                    <p className={`text-xs ${theme.accent} opacity-80`}>{stats.libraryName}</p>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                <StatBlock icon={<Library className="h-4 w-4" />} value={stats.gamesOwned} label="Games" theme={theme} />
                <StatBlock icon={<Dice6 className="h-4 w-4" />} value={stats.totalPlays} label="Plays" theme={theme} />
                <StatBlock icon={<Star className="h-4 w-4" />} value={stats.hIndex} label="H-Index" theme={theme} />
                <StatBlock icon={<Trophy className="h-4 w-4" />} value={stats.achievements} label="Achievements" theme={theme} />
              </div>

              {/* Top games */}
              {stats.topGames.length > 0 && (
                <div>
                  <p className={`text-xs font-medium ${theme.accent} mb-1.5`}>Most Played</p>
                  <div className="flex gap-2 flex-wrap">
                    {stats.topGames.slice(0, 3).map((g) => (
                      <span
                        key={g.title}
                        className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${theme.text}`}
                      >
                        {g.title} ({g.plays})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className={`absolute bottom-4 right-6 text-xs ${theme.accent} opacity-60`}>
                gametaverns.com
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button onClick={handleDownload} disabled={downloading} className="gap-2">
                <Download className="h-4 w-4" />
                {downloading ? "Generating..." : "Download PNG"}
              </Button>
              <Button variant="outline" onClick={handleCopyImage} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Share on X, Instagram, Discord, or your blog. The image includes a link back to GameTaverns.
            </p>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Create a library first to generate your stats card.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function StatBlock({ icon, value, label, theme }: { icon: React.ReactNode; value: number; label: string; theme: typeof CARD_THEMES[0] }) {
  return (
    <div className="text-center">
      <div className={`flex justify-center mb-1 ${theme.accent}`}>{icon}</div>
      <div className={`font-display text-xl font-bold ${theme.text}`}>{value}</div>
      <div className={`text-xs ${theme.accent} opacity-70`}>{label}</div>
    </div>
  );
}
