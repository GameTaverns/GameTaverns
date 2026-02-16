import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Library as LibraryIcon, Shield } from "lucide-react";
import { SiteForumCard } from "./SiteForumCard";
import { LibraryForumCard } from "./LibraryForumCard";
import { ClubForumCard } from "./ClubForumCard";
import { useMyClubs } from "@/hooks/useClubs";

export function CommunityTab() {
  const { data: myClubs = [] } = useMyClubs();
  const activeClubs = myClubs.filter((c) => c.status === "approved" && c.is_active);

  return (
    <Tabs defaultValue="site" className="w-full">
      <TabsList className="bg-wood-dark/60 border border-wood-medium/40 h-auto gap-1 p-1 mb-3">
        <TabsTrigger
          value="site"
          className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
        >
          <Globe className="h-3.5 w-3.5" />
          Site-Wide
        </TabsTrigger>
        <TabsTrigger
          value="library"
          className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
        >
          <LibraryIcon className="h-3.5 w-3.5" />
          My Libraries
        </TabsTrigger>
        <TabsTrigger
          value="clubs"
          className="gap-1.5 text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
        >
          <Shield className="h-3.5 w-3.5" />
          My Clubs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="site">
        <SiteForumCard />
      </TabsContent>

      <TabsContent value="library">
        <LibraryForumCard />
      </TabsContent>

      <TabsContent value="clubs">
        {activeClubs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            You're not a member of any active clubs yet.
          </p>
        ) : (
          <div className="space-y-4">
            {activeClubs.map((club) => (
              <ClubForumCard
                key={club.id}
                clubId={club.id}
                clubSlug={club.slug}
                isOwner={false}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
