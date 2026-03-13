import { useState } from "react";
import { supabase } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Save, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const EXPANSION_TYPES = [
  { value: "expansion", label: "Expansion" },
  { value: "promo", label: "Promo" },
  { value: "accessory", label: "Accessory" },
  { value: "scenario", label: "Scenario" },
  { value: "mini_expansion", label: "Mini Expansion" },
];

const SCORING_TYPES = [
  { value: "highest_wins", label: "Highest Score Wins" },
  { value: "lowest_wins", label: "Lowest Score Wins" },
  { value: "win_lose", label: "Win / Lose (no score)" },
  { value: "cooperative", label: "Cooperative" },
  { value: "no_score", label: "No Scoring" },
];

interface CatalogDataEditorProps {
  catalogId: string;
  currentData: {
    title: string;
    is_expansion: boolean;
    min_players: number | null;
    max_players: number | null;
    play_time_minutes: number | null;
    weight: number | null;
    year_published: number | null;
    suggested_age: string | null;
    description: string | null;
    image_url: string | null;
    bgg_id: string | null;
    expansion_type?: string;
    scoring_type?: string;
  };
}

export function CatalogDataEditor({ catalogId, currentData }: CatalogDataEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(currentData.title);
  const [isExpansion, setIsExpansion] = useState(currentData.is_expansion);
  const [expansionType, setExpansionType] = useState(currentData.expansion_type ?? "expansion");
  const [scoringType, setScoringType] = useState(currentData.scoring_type ?? "highest_wins");
  const [minPlayers, setMinPlayers] = useState(currentData.min_players?.toString() ?? "");
  const [maxPlayers, setMaxPlayers] = useState(currentData.max_players?.toString() ?? "");
  const [playTime, setPlayTime] = useState(currentData.play_time_minutes?.toString() ?? "");
  const [weight, setWeight] = useState(currentData.weight?.toString() ?? "");
  const [yearPublished, setYearPublished] = useState(currentData.year_published?.toString() ?? "");
  const [suggestedAge, setSuggestedAge] = useState(currentData.suggested_age ?? "");
  const [description, setDescription] = useState(currentData.description ?? "");
  const [imageUrl, setImageUrl] = useState(currentData.image_url ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("game_catalog")
        .update({
          title,
          is_expansion: isExpansion,
          expansion_type: isExpansion ? expansionType : "expansion",
          scoring_type: scoringType,
          min_players: minPlayers ? parseInt(minPlayers) : null,
          max_players: maxPlayers ? parseInt(maxPlayers) : null,
          play_time_minutes: playTime ? parseInt(playTime) : null,
          weight: weight ? parseFloat(weight) : null,
          year_published: yearPublished ? parseInt(yearPublished) : null,
          suggested_age: suggestedAge || null,
          description: description || null,
          image_url: imageUrl || null,
        })
        .eq("id", catalogId);

      if (error) throw error;

      toast({ title: "Catalog entry updated", description: "Changes saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["catalog-game"] });
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                <Settings2 className="h-4 w-4" />
                Edit Catalog Data
              </CardTitle>
              <span className="text-xs text-muted-foreground">{open ? "Collapse" : "Expand"}</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="cat-title">Title</Label>
              <Input id="cat-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="cat-expansion" checked={isExpansion} onCheckedChange={setIsExpansion} />
              <Label htmlFor="cat-expansion">Is Expansion</Label>
            </div>

            {isExpansion && (
              <div className="space-y-1">
                <Label>Expansion Type</Label>
                <Select value={expansionType} onValueChange={setExpansionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPANSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Scoring Type</Label>
              <Select value={scoringType} onValueChange={setScoringType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cat-min">Min Players</Label>
                <Input id="cat-min" type="number" value={minPlayers} onChange={(e) => setMinPlayers(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-max">Max Players</Label>
                <Input id="cat-max" type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-time">Play Time (min)</Label>
                <Input id="cat-time" type="number" value={playTime} onChange={(e) => setPlayTime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-weight">Weight</Label>
                <Input id="cat-weight" type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cat-year">Year Published</Label>
                <Input id="cat-year" type="number" value={yearPublished} onChange={(e) => setYearPublished(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cat-age">Suggested Age</Label>
                <Input id="cat-age" value={suggestedAge} onChange={(e) => setSuggestedAge(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="cat-image">Image URL</Label>
              <Input id="cat-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>

            {currentData.bgg_id && (
              <p className="text-xs text-muted-foreground">BGG ID: {currentData.bgg_id}</p>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
