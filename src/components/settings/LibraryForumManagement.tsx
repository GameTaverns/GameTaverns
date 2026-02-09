import { useMemo, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryCategories, useCreateForumCategory, useSetCategoryArchived, type ForumCategory } from "@/hooks/useForum";
import { Archive, ArchiveRestore, MessageSquare } from "lucide-react";
import { FORUM_ICON_OPTIONS, FORUM_COLOR_OPTIONS, type ForumIconValue, type ForumColorValue } from "@/lib/forumOptions";

function CategoryRow({ category }: { category: ForumCategory }) {
  const setArchived = useSetCategoryArchived();

  return (
    <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium truncate">{category.name}</div>
          <Badge variant={category.is_archived ? "outline" : "secondary"}>
            {category.is_archived ? "Archived" : "Active"}
          </Badge>
          <Badge variant="outline">/{category.slug}</Badge>
        </div>
        {category.description && (
          <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{category.description}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setArchived.mutate({ categoryId: category.id, archived: !category.is_archived })}
          disabled={setArchived.isPending}
        >
          {category.is_archived ? (
            <>
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Unarchive
            </>
          ) : (
            <>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function LibraryForumManagement() {
  const { library, settings } = useTenant();
  const libraryId = library?.id;

  const forumEnabled = (settings as any)?.feature_community_forum !== false;

  const { data: categories = [], isLoading } = useLibraryCategories(libraryId);
  const createCategory = useCreateForumCategory();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<ForumIconValue>("MessageSquare");
  const [color, setColor] = useState<ForumColorValue>("blue");
  const [displayOrder, setDisplayOrder] = useState("0");

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.is_archived).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [categories]
  );
  const archivedCategories = useMemo(
    () => categories.filter((c) => c.is_archived).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [categories]
  );

  const canCreate = forumEnabled && !!libraryId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Forum Categories
          </CardTitle>
          <CardDescription>
            Create and organize sections for your library’s forum (e.g., Announcements, Game Nights, Trades).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!forumEnabled && (
            <div className="text-sm text-muted-foreground">
              The forum feature is currently disabled. Turn on <strong>Community Forum</strong> under the Features tab to enable categories.
            </div>
          )}

          {/* Create */}
          <div className="space-y-4 border rounded-lg p-4">
            <div className="font-medium">Create Category</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="forum-cat-name">Name</Label>
                <Input
                  id="forum-cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Announcements"
                  disabled={!canCreate || createCategory.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forum-cat-order">Display order</Label>
                <Input
                  id="forum-cat-order"
                  inputMode="numeric"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value.replace(/[^0-9-]/g, ""))}
                  placeholder="0"
                  disabled={!canCreate || createCategory.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={icon} onValueChange={(v) => setIcon(v as any)} disabled={!canCreate || createCategory.isPending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORUM_ICON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={color} onValueChange={(v) => setColor(v as any)} disabled={!canCreate || createCategory.isPending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORUM_COLOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forum-cat-desc">Description (optional)</Label>
              <Textarea
                id="forum-cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short guidance for what belongs in this category"
                rows={3}
                disabled={!canCreate || createCategory.isPending}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!libraryId) return;
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  createCategory.mutate(
                    {
                      scope: "library",
                      libraryId,
                      name: trimmed,
                      description: description.trim() ? description.trim() : null,
                      icon,
                      color,
                      displayOrder: Number(displayOrder || 0),
                    },
                    {
                      onSuccess: () => {
                        setName("");
                        setDescription("");
                        setDisplayOrder("0");
                      },
                    }
                  );
                }}
                disabled={!canCreate || !name.trim() || createCategory.isPending}
              >
                {createCategory.isPending ? "Creating..." : "Create category"}
              </Button>
            </div>
          </div>

          {/* Lists */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Active</div>
                {activeCategories.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No categories yet.</div>
                ) : (
                  <div className="space-y-2">
                    {activeCategories.map((c) => (
                      <CategoryRow key={c.id} category={c} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Archived</div>
                {archivedCategories.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No archived categories.</div>
                ) : (
                  <div className="space-y-2">
                    {archivedCategories.map((c) => (
                      <CategoryRow key={c.id} category={c} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
