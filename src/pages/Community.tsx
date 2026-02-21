import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, 
  ArrowLeft,
  Pin,
  Lock,
  MessageCircle,
  Plus,
  Eye,
  Shield,
  Vote
} from "lucide-react";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useSiteWideCategories, 
  useLibraryCategories,
  useCategoryThreads, 
  type ForumCategory,
  type ForumThread 
} from "@/hooks/useForum";
import { useCategoryThreadsRealtime } from "@/hooks/useForumRealtime";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { CreateThreadDialog } from "@/components/community/CreateThreadDialog";
import { InlineForumManagement } from "@/components/community/InlineForumManagement";
import { FORUM_ICON_MAP, FORUM_COLOR_MAP } from "@/lib/forumOptions";
import { useMyClubs } from "@/hooks/useClubs";
import { useClubCategories, useLibrariesForumEnabled, type ForumCategory as ClubForumCategory } from "@/hooks/useForum";
import { useMyMemberships } from "@/hooks/useLibraryMembership";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import { Library as LibraryIcon } from "lucide-react";
import { CommunityPollsList } from "@/components/polls/CommunityPollsList";

const ICON_MAP = FORUM_ICON_MAP;
const COLOR_MAP: Record<string, string> = FORUM_COLOR_MAP;

// SMF-style color classes for category headers
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

/** A single subcategory row in the SMF-style list */
function SubcategoryRow({ category }: { category: ForumCategory }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const colorClass = COLOR_MAP[category.color] || "text-blue-500";

  return (
    <Link
      to={`/community/${category.slug}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border/50 last:border-b-0 group"
    >
      <div className="flex-shrink-0">
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm group-hover:text-primary transition-colors">
          {category.name}
        </p>
        {category.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {category.description}
          </p>
        )}
      </div>
    </Link>
  );
}

/** A parent category section — header bar + subcategory rows */
function CategorySection({ category }: { category: ForumCategory }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const headerColor = HEADER_COLOR_MAP[category.color] || HEADER_COLOR_MAP.blue;
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Category header bar */}
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${headerColor} bg-opacity-60`}>
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

      {/* Subcategory rows */}
      {hasChildren ? (
        <div className="bg-card">
          {category.children!.map((sub) => (
            <SubcategoryRow key={sub.id} category={sub} />
          ))}
        </div>
      ) : (
        /* If no children, the parent itself is clickable */
        <Link
          to={`/community/${category.slug}`}
          className="block px-4 py-3 bg-card hover:bg-accent/40 transition-colors text-sm text-muted-foreground"
        >
          Browse threads →
        </Link>
      )}
    </div>
  );
}

function ThreadRow({ thread }: { thread: ForumThread }) {
  return (
    <Link
      to={`/community/thread/${thread.id}`}
      className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 transition-colors border border-border"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {thread.is_pinned && (
            <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
          {thread.is_locked && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-medium truncate">{thread.title}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{thread.author?.display_name || "Unknown"}</span>
          <FeaturedBadge achievement={thread.author?.featured_badge ?? null} size="xs" />
          <span>•</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          <span>{thread.reply_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4" />
          <span>{thread.view_count}</span>
        </div>
      </div>
    </Link>
  );
}

function CategoryView({ categorySlug }: { categorySlug: string }) {
  const { library, isTenantMode } = useTenant();
  
  const { data: siteCategories = [], isLoading: siteCategoriesLoading } = useSiteWideCategories();
  const { data: libraryCategories = [], isLoading: libraryCategoriesLoading } = useLibraryCategories(library?.id);
  
  const categories = isTenantMode ? libraryCategories : siteCategories;
  const categoriesLoading = isTenantMode ? libraryCategoriesLoading : siteCategoriesLoading;
  
  // Search both top-level and children for the slug
  const category = categories.find((c) => c.slug === categorySlug)
    || categories.flatMap((c) => c.children || []).find((c) => c.slug === categorySlug);
  const { data: threads = [], isLoading: threadsLoading } = useCategoryThreads(category?.id, 50);
  const [showCreateThread, setShowCreateThread] = useState(false);
  
  useCategoryThreadsRealtime(category?.id);

  if (categoriesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Category not found</h2>
        <Link to="/community">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forums
          </Button>
        </Link>
      </div>
    );
  }

  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const colorClass = HEADER_COLOR_MAP[category.color] || HEADER_COLOR_MAP.blue;

  const pinnedThreads = threads.filter((t) => t.is_pinned);
  const regularThreads = threads.filter((t) => !t.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/community">
            <Button variant="ghost" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Forums
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${colorClass}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{category.name}</h1>
              <p className="text-muted-foreground">{category.description}</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowCreateThread(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Thread
        </Button>
      </div>

      {/* Category Rules */}
      {category.rules && (
        <Card className="bg-muted/50">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">{category.rules}</p>
          </CardContent>
        </Card>
      )}

      {/* Subcategories rendered as SMF rows */}
      {category.children && category.children.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
            Subcategories
          </div>
          <div className="bg-card">
            {category.children.map((sub) => (
              <SubcategoryRow key={sub.id} category={sub} />
            ))}
          </div>
        </div>
      )}

      {/* Threads */}
      {threadsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : threads.length > 0 ? (
        <div className="space-y-2">
          {pinnedThreads.length > 0 && (
            <>
              <div className="text-sm font-medium text-muted-foreground px-1">Pinned</div>
              {pinnedThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} />
              ))}
              {regularThreads.length > 0 && (
                <div className="text-sm font-medium text-muted-foreground px-1 pt-4">Discussions</div>
              )}
            </>
          )}
          {regularThreads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No discussions yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to start a conversation!</p>
          <Button onClick={() => setShowCreateThread(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Start Discussion
          </Button>
        </div>
      )}

      <CreateThreadDialog
        open={showCreateThread}
        onOpenChange={setShowCreateThread}
        categoryId={category.id}
        categoryName={category.name}
      />
    </div>
  );
}

function ClubForumSection({ clubId, clubName, clubSlug }: { clubId: string; clubName: string; clubSlug: string }) {
  const { data: categories = [], isLoading } = useClubCategories(clubId);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <Link to={`/club/${clubSlug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {clubName}
        </Link>
      </div>
      {categories.map((category) => (
        <ClubCategorySection key={category.id} category={category} clubSlug={clubSlug} />
      ))}
    </div>
  );
}

/** SMF-style section for club categories on the community page */
function ClubCategorySection({ category, clubSlug }: { category: ClubForumCategory; clubSlug: string }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const headerColor = HEADER_COLOR_MAP[category.color] || HEADER_COLOR_MAP.blue;
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${headerColor} bg-opacity-60`}>
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
        <div className="bg-card">
          {category.children!.map((sub) => (
            <Link
              key={sub.id}
              to={`/club/${clubSlug}/forum/${sub.slug}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border/50 last:border-b-0 group"
            >
              <div className="flex-shrink-0">
                {(() => {
                  const SubIcon = ICON_MAP[sub.icon] || MessageSquare;
                  const subColor = COLOR_MAP[sub.color] || "text-blue-500";
                  return <SubIcon className={`h-5 w-5 ${subColor}`} />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm group-hover:text-primary transition-colors">
                  {sub.name}
                </p>
                {sub.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {sub.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Link
          to={`/club/${clubSlug}/forum/${category.slug}`}
          className="block px-4 py-3 bg-card hover:bg-accent/40 transition-colors text-sm text-muted-foreground"
        >
          Browse threads →
        </Link>
      )}
    </div>
  );
}

/** Library forum section for the platform community page */
function LibraryForumSection({ libraryId, libraryName, librarySlug }: { libraryId: string; libraryName: string; librarySlug: string }) {
  const { data: categories = [], isLoading } = useLibraryCategories(libraryId);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <LibraryIcon className="h-4 w-4 text-muted-foreground" />
        <TenantLink href={getLibraryUrl(librarySlug, "/community")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {libraryName}
        </TenantLink>
      </div>
      {categories.map((category) => {
        const Icon = ICON_MAP[category.icon] || MessageSquare;
        const headerColor = HEADER_COLOR_MAP[category.color] || HEADER_COLOR_MAP.blue;
        const hasChildren = category.children && category.children.length > 0;

        return (
          <div key={category.id} className="rounded-lg border border-border overflow-hidden">
            <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-border ${headerColor} bg-opacity-60`}>
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
              <div className="bg-card">
                {category.children!.map((sub) => {
                  const SubIcon = ICON_MAP[sub.icon] || MessageSquare;
                  const subColor = COLOR_MAP[sub.color] || "text-blue-500";
                  return (
                    <TenantLink
                      key={sub.id}
                      href={getLibraryUrl(librarySlug, `/community/${sub.slug}`)}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border/50 last:border-b-0 group"
                    >
                      <div className="flex-shrink-0">
                        <SubIcon className={`h-5 w-5 ${subColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm group-hover:text-primary transition-colors">
                          {sub.name}
                        </p>
                        {sub.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {sub.description}
                          </p>
                        )}
                      </div>
                    </TenantLink>
                  );
                })}
              </div>
            ) : (
              <TenantLink
                href={getLibraryUrl(librarySlug, `/community/${category.slug}`)}
                className="block px-4 py-3 bg-card hover:bg-accent/40 transition-colors text-sm text-muted-foreground"
              >
                Browse threads →
              </TenantLink>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ForumHome() {
  const { library, isTenantMode, isOwner } = useTenant();
  const { isAdmin } = useAuth();
  const { data: myClubs = [] } = useMyClubs();
  
  const { data: memberships = [] } = useMyMemberships();
  
  const allLibraryIds = memberships
    .filter(m => m.library)
    .map(m => m.library!.id);
  const { data: forumEnabledMap } = useLibrariesForumEnabled(allLibraryIds);
  
  const librariesWithForums = memberships.filter(m => 
    m.library && forumEnabledMap?.get(m.library.id) === true
  );

  const { data: siteCategories = [], isLoading: siteCategoriesLoading } = useSiteWideCategories();
  const { data: libraryCategories = [], isLoading: libraryCategoriesLoading } = useLibraryCategories(library?.id);
  
  const categories = isTenantMode ? libraryCategories : siteCategories;
  const categoriesLoading = isTenantMode ? libraryCategoriesLoading : siteCategoriesLoading;
  
  const forumTitle = isTenantMode && library ? `${library.name} Forums` : "Community Forums";
  const forumDescription = isTenantMode 
    ? "Discuss games, share tips, and connect with fellow members"
    : "Discuss board games, find players, and connect with the community";

  // Show manage button for site admins (site-wide) or library owners (library forums)
  const canManage = isTenantMode ? isOwner : isAdmin;

  // Filter to approved/active clubs
  const activeClubs = myClubs.filter((c) => c.status === "approved" && c.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <TenantLink href={getPlatformUrl("/dashboard?tab=community")}>
            <Button variant="ghost" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </TenantLink>
          <div>
            <h1 className="text-3xl font-bold">{forumTitle}</h1>
            <p className="text-muted-foreground mt-1">{forumDescription}</p>
          </div>
        </div>
        {canManage && (
          <InlineForumManagement
            scope={isTenantMode ? "library" : "site"}
            libraryId={isTenantMode ? library?.id : undefined}
            categories={categories}
            isLoading={categoriesLoading}
          />
        )}
      </div>

      {categoriesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No forum categories yet</h3>
          <p className="text-muted-foreground">
            {isTenantMode 
              ? "The library owner hasn't set up any forum categories yet."
              : "No categories have been created."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <CategorySection key={category.id} category={category} />
          ))}
        </div>
      )}

      {/* Library Forums */}
      {!isTenantMode && librariesWithForums.length > 0 && (
        <div className="space-y-6">
          <div className="border-t border-border pt-6">
            <h2 className="text-xl font-bold font-display mb-4">My Library Forums</h2>
          </div>
          {librariesWithForums.map((membership) => (
            <LibraryForumSection
              key={membership.library!.id}
              libraryId={membership.library!.id}
              libraryName={membership.library!.name}
              librarySlug={membership.library!.slug}
            />
          ))}
        </div>
      )}

      {/* Club Forums */}
      {activeClubs.length > 0 && (
        <div className="space-y-6">
          <div className="border-t border-border pt-6">
            <h2 className="text-xl font-bold font-display mb-4">Club Forums</h2>
          </div>
          {activeClubs.map((club) => (
            <ClubForumSection key={club.id} clubId={club.id} clubName={club.name} clubSlug={club.slug} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Community() {
  const { categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "forums";

  // If viewing a specific category, skip tabs
  if (categorySlug) {
    return (
      <Layout hideSidebar>
        <div className="max-w-4xl mx-auto">
          <CategoryView categorySlug={categorySlug} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top-level tab switcher */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setSearchParams({})}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "forums"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Forums
          </button>
          <button
            onClick={() => setSearchParams({ tab: "polls" })}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "polls"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Vote className="h-4 w-4" />
            Polls
          </button>
        </div>

        {activeTab === "polls" ? <CommunityPollsList /> : <ForumHome />}
      </div>
    </Layout>
  );
}
