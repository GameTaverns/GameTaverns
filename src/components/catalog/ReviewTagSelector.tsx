import { useRatingTags, type RatingTag } from "@/hooks/useRatingTags";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface ReviewTagSelectorProps {
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  player_count: "Player Count",
  complexity: "Complexity",
  experience: "Game Feel",
  quality: "Production Quality",
  value: "Value & Longevity",
};

const CATEGORY_ORDER = ["player_count", "complexity", "experience", "quality", "value"];

export function ReviewTagSelector({ selectedTagIds, onToggle }: ReviewTagSelectorProps) {
  const { data: tags = [] } = useRatingTags();

  const grouped = CATEGORY_ORDER.reduce<Record<string, RatingTag[]>>((acc, cat) => {
    acc[cat] = tags.filter(t => t.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">What describes this game? (select all that apply)</Label>
      {CATEGORY_ORDER.map(cat => {
        const catTags = grouped[cat];
        if (!catTags || catTags.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs text-muted-foreground mb-1.5">{CATEGORY_LABELS[cat]}</p>
            <div className="flex flex-wrap gap-1.5">
              {catTags.map(tag => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggle(tag.id)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                      selected
                        ? tag.is_positive === false
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:border-border"
                    )}
                  >
                    {tag.icon && <span>{tag.icon}</span>}
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
