import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  MessageSquare, 
  Library as LibraryIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibraryCategories, useLibrariesForumEnabled, type ForumCategory } from "@/hooks/useForum";
import { useMyMemberships } from "@/hooks/useLibraryMembership";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { InlineForumManagement } from "./InlineForumManagement";
import { FORUM_ICON_MAP, FORUM_COLOR_MAP } from "@/lib/forumOptions";

const ICON_MAP = FORUM_ICON_MAP;
const COLOR_MAP: Record<string, string> = FORUM_COLOR_MAP;

const HEADER_COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  blue: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  green: "bg-green-500/20 text-green-500 border-green-500/30",
  purple: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  cyan: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  red: "bg-red-500/20 text-red-500 border-red-500/30",
  orange: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  pink: "bg-pink-500/20 text-pink-500 border-pink-500/30",
  indigo: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30",
  teal: "bg-teal-500/20 text-teal-500 border-teal-500/30",
  emerald: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  sky: "bg-sky-500/20 text-sky-500 border-sky-500/30",
  violet: "bg-violet-500/20 text-violet-500 border-violet-500/30",
  fuchsia: "bg-fuchsia-500/20 text-fuchsia-500 border-fuchsia-500/30",
  rose: "bg-rose-500/20 text-rose-500 border-rose-500/30",
  lime: "bg-lime-500/20 text-lime-500 border-lime-500/30",
  slate: "bg-slate-500/20 text-slate-500 border-slate-500/30",
  zinc: "bg-zinc-500/20 text-zinc-500 border-zinc-500/30",
  stone: "bg-stone-500/20 text-stone-500 border-stone-500/30",
};

function SubcategoryRow({ category, librarySlug }: { category: ForumCategory; librarySlug: string }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const colorClass = COLOR_MAP[category.color] || "text-blue-500";

  return (
    <a
      href={getLibraryUrl(librarySlug, `/community/${category.slug}`)}
      className="flex items-center gap-4 px-4 py-3 hover:bg-wood-medium/30 transition-colors border-b border-wood-medium/30 last:border-b-0 group"
    >
      <div className="flex-shrink-0">
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-cream group-hover:text-secondary transition-colors">
          {category.name}
        </p>
        {category.description && (
          <p className="text-xs text-cream/50 mt-0.5 line-clamp-1">
            {category.description}
          </p>
        )}
      </div>
    </a>
  );
}

function CategorySection({ category, librarySlug }: { category: ForumCategory; librarySlug: string }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const headerColor = HEADER_COLOR_MAP[category.color] || HEADER_COLOR_MAP.blue;
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="rounded-lg border border-wood-medium/40 overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-wood-medium/40 ${headerColor} bg-opacity-60`}>
        <div className="p-1.5 rounded border border-current/20">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide">
            {category.name}
          </h3>
          {category.description && (
            <p className="text-xs opacity-80 mt-0.5">{category.description}</p>
          )}
        </div>
      </div>

      {hasChildren ? (
        <div className="bg-wood-dark/20">
          {category.children!.map((sub) => (
            <SubcategoryRow key={sub.id} category={sub} librarySlug={librarySlug} />
          ))}
        </div>
      ) : (
        <a
          href={getLibraryUrl(librarySlug, `/community/${category.slug}`)}
          className="block px-4 py-3 bg-wood-dark/20 hover:bg-wood-medium/30 transition-colors text-sm text-cream/60"
        >
          Browse threads →
        </a>
      )}
    </div>
  );
}

interface LibraryTabContentProps {
  libraryId: string;
  librarySlug: string;
  libraryName: string;
  memberRole: string;
}

function LibraryTabContent({ libraryId, librarySlug, libraryName, memberRole }: LibraryTabContentProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useLibraryCategories(libraryId);

  const libraryForumUrl = getLibraryUrl(librarySlug, "/community");
  const canManage = memberRole === "owner" || memberRole === "admin";

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <InlineForumManagement
            scope="library"
            libraryId={libraryId}
            categories={categories}
            isLoading={categoriesLoading}
          />
        </div>
      )}

      {categoriesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full bg-wood-medium/40" />
          <Skeleton className="h-32 w-full bg-wood-medium/40" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare className="h-8 w-8 mx-auto text-cream/40 mb-2" />
          <p className="text-sm text-cream/60">No forum categories created yet for {libraryName}</p>
          {canManage ? (
            <p className="text-xs text-cream/40 mt-1">Use the Manage button above to create categories</p>
          ) : (
            <p className="text-xs text-cream/40 mt-1">The library owner hasn't set up forum categories yet</p>
          )}
        </div>
      ) : (
        categories.map((category) => (
          <CategorySection key={category.id} category={category} librarySlug={librarySlug} />
        ))
      )}
    </div>
  );
}

export function LibraryForumCard() {
  const { data: memberships = [], isLoading: membershipsLoading } = useMyMemberships();
  const [activeTab, setActiveTab] = useState<string>("");

  const allLibraryIds = memberships
    .filter(m => m.library)
    .map(m => m.library!.id);

  const { data: forumEnabledMap, isLoading: forumCheckLoading } = useLibrariesForumEnabled(allLibraryIds);

  const isLoading = membershipsLoading || forumCheckLoading;

  const librariesWithForums = memberships.filter(m => 
    m.library && forumEnabledMap?.get(m.library.id) === true
  );

  if (librariesWithForums.length > 0 && !activeTab) {
    setActiveTab(librariesWithForums[0].library!.id);
  }

  if (isLoading) {
    return (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LibraryIcon className="h-5 w-5 text-secondary" />
            My Library Forums
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full bg-wood-medium/40" />
        </CardContent>
      </Card>
    );
  }

  if (librariesWithForums.length === 0) {
    return (
      <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LibraryIcon className="h-5 w-5 text-secondary" />
            My Library Forums
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <LibraryIcon className="h-8 w-8 mx-auto text-cream/40 mb-2" />
            <p className="text-sm text-cream/60">Join a community to access their forums</p>
            <Link to="/directory" className="mt-2 inline-block">
              <Button variant="outline" size="sm" className="border-secondary/50 text-cream">
                Browse Communities
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LibraryIcon className="h-5 w-5 text-secondary" />
          My Library Forums
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-wood-dark/60 border border-wood-medium/40 flex-wrap h-auto gap-1 p-1">
            {librariesWithForums.map((membership) => (
              <TabsTrigger
                key={membership.library!.id}
                value={membership.library!.id}
                className="text-xs text-cream/70 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=inactive]:hover:bg-wood-medium/40"
              >
                {membership.library!.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {librariesWithForums.map((membership) => (
            <TabsContent key={membership.library!.id} value={membership.library!.id}>
              <LibraryTabContent
                libraryId={membership.library!.id}
                librarySlug={membership.library!.slug}
                libraryName={membership.library!.name}
                memberRole={membership.role}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
