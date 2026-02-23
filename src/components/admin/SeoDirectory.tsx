import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Globe, MapPin, Puzzle, Users, BookOpen, User, Library, FileText, Megaphone } from "lucide-react";

interface SeoPage {
  type: string;
  slug: string;
  label: string;
  url: string;
}

export function SeoDirectory() {
  const { data: mechanics = [], isLoading: mechLoading } = useQuery({
    queryKey: ["admin-seo-mechanics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mechanics")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: cities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ["admin-seo-cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("libraries")
        .select("city")
        .not("city", "is", null)
        .order("city");
      if (error) throw error;
      const unique = [...new Set((data || []).map((l: any) => l.city).filter(Boolean))];
      return unique as string[];
    },
  });

  const { data: catalogGames = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["admin-seo-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_catalog")
        .select("id, title, slug")
        .not("slug", "is", null)
        .order("title")
        .limit(5000);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-seo-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_user_profiles")
        .select("username")
        .not("username", "is", null)
        .limit(5000);
      if (error) throw error;
      return data;
    },
  });

  const { data: libraries = [], isLoading: libsLoading } = useQuery({
    queryKey: ["admin-seo-libraries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("libraries_public")
        .select("slug, name")
        .not("slug", "is", null)
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = mechLoading || citiesLoading || catalogLoading || profilesLoading || libsLoading;

  const staticPages: SeoPage[] = [
    { type: "Static", slug: "home", label: "Homepage", url: "/" },
    { type: "Static", slug: "features", label: "Features", url: "/features" },
    { type: "Static", slug: "directory", label: "Library Directory", url: "/directory" },
    { type: "Static", slug: "catalog", label: "Game Catalog", url: "/catalog" },
    { type: "Static", slug: "grow", label: "Growth Hub", url: "/grow" },
    { type: "Player Count", slug: "1", label: "Games for 1 Player", url: "/games-for-1-players" },
    { type: "Player Count", slug: "2", label: "Games for 2 Players", url: "/games-for-2-players" },
    { type: "Player Count", slug: "3", label: "Games for 3 Players", url: "/games-for-3-players" },
    { type: "Player Count", slug: "4", label: "Games for 4 Players", url: "/games-for-4-players" },
    { type: "Player Count", slug: "5", label: "Games for 5 Players", url: "/games-for-5-players" },
    { type: "Player Count", slug: "6", label: "Games for 6 Players", url: "/games-for-6-players" },
    { type: "Player Count", slug: "7", label: "Games for 7 Players", url: "/games-for-7-players" },
    { type: "Player Count", slug: "8", label: "Games for 8 Players", url: "/games-for-8-players" },
    { type: "Index", slug: "mechanics", label: "All Mechanics Index", url: "/catalog/mechanics" },
  ];

  const mechanicPages: SeoPage[] = mechanics.map((m: any) => ({
    type: "Mechanic",
    slug: m.slug,
    label: m.name,
    url: `/catalog/mechanic/${m.slug}`,
  }));

  const cityPages: SeoPage[] = cities.map((c) => ({
    type: "City",
    slug: c.toLowerCase().replace(/\s+/g, "-"),
    label: `Libraries in ${c}`,
    url: `/libraries/${encodeURIComponent(c)}`,
  }));

  const catalogPages: SeoPage[] = catalogGames.map((g: any) => ({
    type: "Catalog Game",
    slug: g.slug,
    label: g.title,
    url: `/catalog/${g.slug}`,
  }));

  const profilePages: SeoPage[] = profiles.filter((p: any) => p.username).map((p: any) => ({
    type: "User Profile",
    slug: p.username,
    label: p.username,
    url: `/u/${p.username}`,
  }));

  const libraryPages: SeoPage[] = libraries.map((l: any) => ({
    type: "Library",
    slug: l.slug,
    label: l.name || l.slug,
    url: `https://${l.slug}.gametaverns.app/`,
  }));

  const allPages = [...staticPages, ...mechanicPages, ...cityPages, ...catalogPages, ...profilePages, ...libraryPages];

  const grouped: Record<string, SeoPage[]> = {
    "Static": allPages.filter((p) => p.type === "Static"),
    "Player Count": allPages.filter((p) => p.type === "Player Count"),
    "Index": allPages.filter((p) => p.type === "Index"),
    "Mechanic": allPages.filter((p) => p.type === "Mechanic"),
    "City": allPages.filter((p) => p.type === "City"),
    "Catalog Game": allPages.filter((p) => p.type === "Catalog Game"),
    "User Profile": allPages.filter((p) => p.type === "User Profile"),
    "Library": allPages.filter((p) => p.type === "Library"),
  };

  const typeIcons: Record<string, React.ReactNode> = {
    "Static": <FileText className="h-4 w-4" />,
    "Player Count": <Users className="h-4 w-4" />,
    "Index": <Globe className="h-4 w-4" />,
    "Mechanic": <Puzzle className="h-4 w-4" />,
    "City": <MapPin className="h-4 w-4" />,
    "Catalog Game": <BookOpen className="h-4 w-4" />,
    "User Profile": <User className="h-4 w-4" />,
    "Library": <Library className="h-4 w-4" />,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-cream">SEO Pages Directory</h2>
          <p className="text-sm text-cream/60">{allPages.length} total SEO landing pages</p>
        </div>
        <Badge variant="outline" className="border-secondary/50 text-secondary">
          {allPages.length} pages
        </Badge>
      </div>

      {Object.entries(grouped).map(([type, pages]) => {
        if (pages.length === 0) return null;
        return (
          <Card key={type} className="bg-wood-panel/50 border-wood-medium/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display text-cream flex items-center gap-2">
                {typeIcons[type]}
                {type} Pages
                <Badge variant="secondary" className="ml-auto text-xs">{pages.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-1">
                {pages.map((page) => (
                  <a
                    key={page.url}
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-wood-medium/30 transition-colors group"
                  >
                    <span className="text-sm text-cream/80 group-hover:text-cream">{page.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-cream/40 font-mono">{page.url}</span>
                      <ExternalLink className="h-3 w-3 text-cream/30 group-hover:text-secondary" />
                    </span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
