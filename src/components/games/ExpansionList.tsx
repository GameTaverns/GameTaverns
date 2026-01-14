import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GameWithRelations } from "@/types/game";
import { useDemoMode } from "@/contexts/DemoContext";
import { cn, proxiedImageUrl, directImageUrl } from "@/lib/utils";

interface ExpansionListProps {
  expansions: GameWithRelations[];
  parentTitle: string;
}

interface ExpansionImageProps {
  imageUrl: string;
  title: string;
}

function ExpansionImage({ imageUrl, title }: ExpansionImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getImageSrc = () => {
    if (useFallback) return proxiedImageUrl(imageUrl);
    return directImageUrl(imageUrl);
  };

  const handleImageError = () => {
    if (!useFallback) {
      setUseFallback(true);
    } else {
      setImageError(true);
    }
  };

  if (imageError) {
    return (
      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={getImageSrc()}
      alt={title}
      className="h-10 w-10 rounded object-contain bg-muted"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleImageError}
    />
  );
}

export function ExpansionList({ expansions, parentTitle }: ExpansionListProps) {
  const { isDemoMode } = useDemoMode();
  const [isExpanded, setIsExpanded] = useState(false);

  if (expansions.length === 0) return null;

  const basePath = isDemoMode ? "/demo/game" : "/game";

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Package className="h-4 w-4" />
        <span className="text-xs">
          {expansions.length} expansion{expansions.length !== 1 ? "s" : ""}
        </span>
      </Button>

      {isExpanded && (
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-border">
          {expansions.map((expansion) => (
            <Link
              key={expansion.id}
              to={`${basePath}/${expansion.slug || expansion.id}`}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
              onClick={(e) => e.stopPropagation()}
            >
              {expansion.image_url ? (
                <ExpansionImage imageUrl={expansion.image_url} title={expansion.title} />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary truncate transition-colors">
                  {expansion.title}
                </p>
                {expansion.is_for_sale && expansion.sale_price && (
                  <Badge className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 mt-0.5">
                    ${expansion.sale_price}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
