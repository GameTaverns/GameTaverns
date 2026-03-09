import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useNewsFeed, useNewsCategories, type NewsArticle } from "@/hooks/useNews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, ThumbsDown, ExternalLink, Newspaper, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function ArticleCard({ article }: { article: NewsArticle }) {
  return (
    <Link to={`/news/${article.slug}`}>
      <Card className="overflow-hidden card-hover group">
        <div className="flex flex-col sm:flex-row">
          {article.image_url && (
            <div className="sm:w-48 sm:min-w-[12rem] h-40 sm:h-auto overflow-hidden bg-muted">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          )}
          <CardContent className="flex-1 p-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(article.categories || []).map(cat => (
                <Badge key={cat.id} variant="secondary" className="text-xs">
                  {cat.name}
                </Badge>
              ))}
            </div>
            <h3 className="font-display font-semibold text-foreground text-lg leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
              {article.title}
            </h3>
            {article.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{article.summary}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {article.source && (
                <span className="font-medium">{article.source.name}</span>
              )}
              {article.author_name && <span>by {article.author_name}</span>}
              {article.published_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                <span className="flex items-center gap-0.5">
                  <ThumbsUp className="h-3 w-3" /> {article.upvotes}
                </span>
              </span>
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

export default function NewsFeed() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || undefined;
  const [page] = useState(1);

  const { data: categories = [] } = useNewsCategories();
  const { data: articles = [], isLoading } = useNewsFeed(activeCategory, page);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-primary" />
            Board Game News
          </h1>
          <p className="text-muted-foreground mt-1">Stay up to date with the latest from the tabletop world</p>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <Button
            variant={!activeCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchParams({})}
            className="shrink-0"
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.slug ? "default" : "outline"}
              size="sm"
              onClick={() => setSearchParams({ category: cat.slug })}
              className="shrink-0"
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Article list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <Skeleton className="sm:w-48 h-40 sm:h-32" />
                  <div className="flex-1 p-4 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">No news yet</h3>
            <p className="text-muted-foreground text-sm">
              {activeCategory ? "No articles in this category yet. Check back soon!" : "News articles will appear here once sources are configured."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
