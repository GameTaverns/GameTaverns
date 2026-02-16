import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Library as LibraryIcon } from "lucide-react";
import { SiteForumCard } from "./SiteForumCard";
import { LibraryForumCard } from "./LibraryForumCard";

export function CommunityTab() {
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
      </TabsList>

      <TabsContent value="site">
        <SiteForumCard />
      </TabsContent>

      <TabsContent value="library">
        <LibraryForumCard />
      </TabsContent>
    </Tabs>
  );
}
