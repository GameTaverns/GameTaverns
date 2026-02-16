import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Pin,
  Lock,
  MessageCircle,
  ArrowLeft,
  Plus,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FeaturedBadge } from "@/components/achievements/FeaturedBadge";
import { useClubCategories, useRecentClubThreads, useCategoryThreads, type ForumThread, type ForumCategory } from "@/hooks/useForum";
import { InlineForumManagement } from "./InlineForumManagement";
import { CreateThreadDialog } from "./CreateThreadDialog";
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

/** SMF-style subcategory row */
function SubcategoryRow({ category, clubSlug }: { category: ForumCategory; clubSlug: string }) {
  const Icon = ICON_MAP[category.icon] || MessageSquare;
  const colorClass = COLOR_MAP[category.color] || "text-blue-500";

  return (
    <Link
      to={`/club/${clubSlug}/forum/${category.slug}`}
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

/** SMF-style parent category section */
function CategorySection({ category, clubSlug }: { category: ForumCategory; clubSlug: string }) {
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
            <SubcategoryRow key={sub.id} category={sub} clubSlug={clubSlug} />
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

/** SMF-style thread row */
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

interface ClubForumCardProps {
  clubId: string;
  clubSlug: string;
  isOwner: boolean;
  activeCategorySlug?: string;
}

export function ClubForumCard({ clubId, clubSlug, isOwner, activeCategorySlug }: ClubForumCardProps) {
  const [createThreadOpen, setCreateThreadOpen] = useState(false);
  const { data: categories = [], isLoading: categoriesLoading } = useClubCategories(clubId);

  const activeCategory = activeCategorySlug
    ? categories.find((c) => c.slug === activeCategorySlug)
      || categories.flatMap((c) => c.children || []).find((c) => c.slug === activeCategorySlug)
    : undefined;

  const { data: categoryThreads = [], isLoading: categoryThreadsLoading } = useCategoryThreads(
    activeCategory?.id,
    50
  );

  // Category detail view
  if (activeCategorySlug && activeCategory) {
    const Icon = ICON_MAP[activeCategory.icon] || MessageSquare;
    const colorClass = HEADER_COLOR_MAP[activeCategory.color] || HEADER_COLOR_MAP.blue;

    const pinnedThreads = categoryThreads.filter((t) => t.is_pinned);
    const regularThreads = categoryThreads.filter((t) => !t.is_pinned);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/club/${clubSlug}`}>
              <Button variant="ghost" className="-ml-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Forum
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${colorClass}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{activeCategory.name}</h2>
                {activeCategory.description && (
                  <p className="text-muted-foreground">{activeCategory.description}</p>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => setCreateThreadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Button>
        </div>

        {/* Category Rules */}
        {activeCategory.rules && (
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">{activeCategory.rules}</p>
            </CardContent>
          </Card>
        )}

        {/* Subcategories */}
        {activeCategory.children && activeCategory.children.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
              Subcategories
            </div>
            <div className="bg-card">
              {activeCategory.children.map((sub) => (
                <SubcategoryRow key={sub.id} category={sub} clubSlug={clubSlug} />
              ))}
            </div>
          </div>
        )}

        {/* Threads */}
        {categoryThreadsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : categoryThreads.length > 0 ? (
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
            <Button onClick={() => setCreateThreadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Start Discussion
            </Button>
          </div>
        )}

        <CreateThreadDialog
          open={createThreadOpen}
          onOpenChange={setCreateThreadOpen}
          categoryId={activeCategory.id}
          categoryName={activeCategory.name}
        />
      </div>
    );
  }

  // Forum home — SMF-style category sections
  return (
    <div className="space-y-6">
      {/* Management controls for club owner */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold font-display">Club Forums</h2>
        {isOwner && (
          <InlineForumManagement
            scope="club"
            clubId={clubId}
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
            {isOwner
              ? "Use the Manage button above to create categories"
              : "The club owner hasn't set up forum categories yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <CategorySection key={category.id} category={category} clubSlug={clubSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
