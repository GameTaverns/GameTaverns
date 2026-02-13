import { useState } from "react";
import { Settings, Plus, Archive, ArchiveRestore, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCreateForumCategory, useSetCategoryArchived, useDeleteForumCategory, type ForumCategory } from "@/hooks/useForum";
import { FORUM_ICON_OPTIONS, FORUM_COLOR_OPTIONS, type ForumIconValue, type ForumColorValue } from "@/lib/forumOptions";

interface InlineForumManagementProps {
  scope: "site" | "library" | "club";
  libraryId?: string;
  clubId?: string;
  categories: ForumCategory[];
  isLoading?: boolean;
}

function CategoryRow({ category }: { category: ForumCategory }) {
  const setArchived = useSetCategoryArchived();
  const deleteCategory = useDeleteForumCategory();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    deleteCategory.mutate({ categoryId: category.id, libraryId: category.library_id });
    setShowDeleteConfirm(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded bg-wood-dark/40 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{category.name}</span>
        <Badge variant={category.is_archived ? "outline" : "secondary"} className="text-xs">
          {category.is_archived ? "Archived" : "Active"}
        </Badge>
        {category.is_system && (
          <Badge variant="outline" className="text-xs text-cream/50">
            System
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-cream/70 hover:text-cream"
          onClick={() => setArchived.mutate({ categoryId: category.id, archived: !category.is_archived })}
          disabled={setArchived.isPending || category.is_system}
          title={category.is_archived ? "Restore category" : "Archive category"}
        >
          {category.is_archived ? (
            <ArchiveRestore className="h-3.5 w-3.5" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
        </Button>
        
        {/* Only show delete for non-system categories */}
        {!category.is_system && (
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                disabled={deleteCategory.isPending}
                title="Delete category permanently"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{category.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this category and all its threads. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

export function InlineForumManagement({ scope, libraryId, clubId, categories, isLoading }: InlineForumManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<ForumIconValue>("MessageSquare");
  const [color, setColor] = useState<ForumColorValue>("blue");
  const [displayOrder, setDisplayOrder] = useState("0");

  const createCategory = useCreateForumCategory();

  const activeCategories = categories.filter((c) => !c.is_archived).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const archivedCategories = categories.filter((c) => c.is_archived);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    createCategory.mutate(
      {
        scope,
        libraryId: scope === "library" ? libraryId : undefined,
        clubId: scope === "club" ? clubId : undefined,
        name: trimmed,
        description: description.trim() || null,
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
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-cream/70 hover:text-cream hover:bg-wood-medium/40 gap-1"
        >
          <Settings className="h-4 w-4" />
          Manage
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4 border-t border-wood-medium/40 pt-4">
        {/* Create New Category */}
        <div className="space-y-3 p-3 rounded-lg bg-wood-dark/30 border border-wood-medium/30">
          <div className="flex items-center gap-2 text-sm font-medium text-cream/80">
            <Plus className="h-4 w-4" />
            Create Category
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-cream/60">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Announcements"
                className="h-8 text-sm bg-wood-dark/60 border-wood-medium/40"
                disabled={createCategory.isPending}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-cream/60">Order</Label>
              <Input
                inputMode="numeric"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value.replace(/[^0-9-]/g, ""))}
                placeholder="0"
                className="h-8 text-sm bg-wood-dark/60 border-wood-medium/40"
                disabled={createCategory.isPending}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-cream/60">Icon</Label>
              <Select value={icon} onValueChange={(v) => setIcon(v as ForumIconValue)} disabled={createCategory.isPending}>
                <SelectTrigger className="h-8 text-sm bg-wood-dark/60 border-wood-medium/40">
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

            <div className="space-y-1">
              <Label className="text-xs text-cream/60">Color</Label>
              <Select value={color} onValueChange={(v) => setColor(v as ForumColorValue)} disabled={createCategory.isPending}>
                <SelectTrigger className="h-8 text-sm bg-wood-dark/60 border-wood-medium/40">
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

          <div className="space-y-1">
            <Label className="text-xs text-cream/60">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short guidance for what belongs here"
              rows={2}
              className="text-sm bg-wood-dark/60 border-wood-medium/40 resize-none"
              disabled={createCategory.isPending}
            />
          </div>

          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || createCategory.isPending}
            className="w-full"
          >
            {createCategory.isPending ? "Creating..." : "Create Category"}
          </Button>
        </div>

        {/* Existing Categories */}
        {!isLoading && (activeCategories.length > 0 || archivedCategories.length > 0) && (
          <div className="space-y-3">
            {activeCategories.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-cream/50 uppercase tracking-wide">Active Categories</div>
                <div className="space-y-1">
                  {activeCategories.map((c) => (
                    <CategoryRow key={c.id} category={c} />
                  ))}
                </div>
              </div>
            )}

            {archivedCategories.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-cream/50 uppercase tracking-wide">Archived</div>
                <div className="space-y-1">
                  {archivedCategories.map((c) => (
                    <CategoryRow key={c.id} category={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

