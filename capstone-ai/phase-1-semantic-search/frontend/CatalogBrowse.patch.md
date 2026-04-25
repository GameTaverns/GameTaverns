# CatalogBrowse.tsx — Semantic Search Toggle Patch

Add a toggle to `src/pages/CatalogBrowse.tsx` so users can switch between
keyword and semantic search. Two-mode design keeps the existing keyword
flow working unchanged when embeddings are unavailable.

## 1. Imports (top of file)

Add to the existing imports block:

```tsx
import { Switch } from "@/components/ui/switch";
import { Sparkles } from "lucide-react";
import { useSemanticCatalogSearch } from "@/hooks/useSemanticCatalogSearch";
```

## 2. State (inside the `CatalogBrowse` component, near the search-term state)

```tsx
const [semanticMode, setSemanticMode] = useState(false);
const semantic = useSemanticCatalogSearch();
```

## 3. Wire the search input

Wherever you currently render the search input (it sets `searchTerm`),
also drive the semantic hook when the toggle is on:

```tsx
<Input
  placeholder={semanticMode
    ? "Try: 'co-op dungeon crawler with light rules'"
    : "Search catalog…"}
  value={semanticMode ? semantic.searchTerm : searchTerm}
  onChange={(e) => semanticMode
    ? semantic.handleSearch(e.target.value)
    : setSearchTerm(e.target.value)}
/>
```

## 4. Toggle UI (next to the search input)

```tsx
<div className="flex items-center gap-2">
  <Sparkles className="h-4 w-4 text-primary" />
  <Switch
    id="semantic-mode"
    checked={semanticMode}
    onCheckedChange={setSemanticMode}
  />
  <Label htmlFor="semantic-mode" className="text-sm">
    Smart search
  </Label>
</div>
```

## 5. Render results

When `semanticMode` is on, render `semantic.results` instead of the
existing keyword results. Each card click should call:

```tsx
onClick={() => {
  semantic.recordClick(semantic.logId, game.id, rank);  // rank = 1-indexed
  navigate(`/catalog/${game.slug ?? game.id}`);
}}
```

Show a small "AI ranked" badge above the result list when in semantic mode
to satisfy the AI-disclosure pattern from your capstone:

```tsx
{semanticMode && semantic.results.length > 0 && (
  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
    <Sparkles className="h-3 w-3" />
    Results ranked by AI semantic similarity
  </div>
)}
```
