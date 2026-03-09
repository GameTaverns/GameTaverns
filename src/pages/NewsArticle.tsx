import { useTranslation } from "react-i18next";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useNewsArticle, useNewsReaction, useNewsBookmark } from "@/hooks/useNews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck, ExternalLink, Clock, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";

export default function NewsArticle() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: article, isLoading } = useNewsArticle(slug);
  const { userReaction, react } = useNewsReaction(article?.id);
  const { isBookmarked, toggle: toggleBookmark } = useNewsBookmark(article?.id);

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!article) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">📰</span>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">Article not found</h2>
          <p className="text-muted-foreground mb-4">This article may have been removed or isn't published yet.</p>
          <Button onClick={() => navigate("/news")}>{t('common.back')}</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ArrowLeft className="h-3 w-3 rotate-180" />
          <Link to="/news" className="hover:text-foreground">News</Link>
          <ArrowLeft className="h-3 w-3 rotate-180" />
          <span className="text-foreground line-clamp-1 max-w-[200px]">{article.title}</span>
        </nav>

        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('common.back')}
        </Button>

        {/* Categories */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(article.categories || []).map(cat => (
            <Link key={cat.id} to={`/news?category=${cat.slug}`}>
              <Badge variant="secondary" className="cursor-pointer hover:bg-accent">{cat.name}</Badge>
            </Link>
          ))}
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 leading-tight">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
          {article.source && (
            <span className="font-medium text-foreground">{article.source.name}</span>
          )}
          {article.author_name && <span>by {article.author_name}</span>}
          {article.published_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(article.published_at), "MMM d, yyyy")}
            </span>
          )}
        </div>

        {/* Hero image */}
        {article.image_url && (
          <div className="rounded-lg overflow-hidden mb-6 bg-muted">
            <img
              src={article.image_url}
              alt={article.title}
              className="w-full max-h-96 object-cover"
            />
          </div>
        )}

        {/* Summary */}
        {article.summary && (
          <p className="text-lg text-muted-foreground mb-6 border-l-4 border-primary pl-4 italic">
            {article.summary}
          </p>
        )}

        {/* Content */}
        <div className="prose prose-sm max-w-none mb-8">
          {article.content_format === "html" ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content || "") }} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.content || ""}
            </ReactMarkdown>
          )}
        </div>

        {/* Source link */}
        {article.source_url && (
          <div className="mb-6">
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Read original article
            </a>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-2 border-t border-b py-3 mb-8">
          {isAuthenticated ? (
            <>
              <Button
                variant={userReaction?.reaction_type === "upvote" ? "default" : "outline"}
                size="sm"
                onClick={() => react.mutate("upvote")}
                disabled={react.isPending}
                className="gap-1.5"
              >
                <ThumbsUp className="h-4 w-4" /> {article.upvotes}
              </Button>
              <Button
                variant={userReaction?.reaction_type === "downvote" ? "destructive" : "outline"}
                size="sm"
                onClick={() => react.mutate("downvote")}
                disabled={react.isPending}
                className="gap-1.5"
              >
                <ThumbsDown className="h-4 w-4" /> {article.downvotes}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleBookmark.mutate()}
                disabled={toggleBookmark.isPending}
                className="gap-1.5"
              >
                {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                {isBookmarked ? "Saved" : "Save"}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <ThumbsUp className="h-4 w-4" /> {article.upvotes}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </article>
    </Layout>
  );
}
