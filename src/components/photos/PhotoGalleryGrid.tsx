import { useState } from "react";
import { Heart, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { UserPhoto } from "@/hooks/usePhotoGallery";
import { useTogglePhotoLike, useDeletePhoto } from "@/hooks/usePhotoGallery";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface PhotoGalleryGridProps {
  photos: UserPhoto[];
  isOwnProfile: boolean;
}

export function PhotoGalleryGrid({ photos, isOwnProfile }: PhotoGalleryGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const toggleLike = useTogglePhotoLike();
  const deletePhoto = useDeletePhoto();
  const { isAuthenticated } = useAuth();

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  const goNext = () => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const goPrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleLike = (photo: UserPhoto) => {
    if (!isAuthenticated) return;
    toggleLike.mutate({ photoId: photo.id, liked: !!photo.liked_by_me });
  };

  const handleDelete = (photoId: string) => {
    deletePhoto.mutate(photoId, {
      onSuccess: () => {
        toast({ title: "Photo deleted" });
        setSelectedIndex(null);
      },
    });
  };

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {isOwnProfile ? "You haven't posted any photos yet." : "No photos yet."}
      </p>
    );
  }

  return (
    <>
      {/* Instagram-style grid */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            onClick={() => setSelectedIndex(idx)}
            className="relative aspect-square overflow-hidden rounded-sm group bg-muted"
          >
            <img
              src={photo.image_url}
              alt={photo.caption || "Photo"}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-white text-sm font-medium">
                <Heart className="h-4 w-4 fill-white" />
                {photo.like_count || 0}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none gap-0 [&>button]:hidden">
          {selectedPhoto && (
            <div className="relative">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Navigation */}
              {selectedIndex !== null && selectedIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={goPrev}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              {selectedIndex !== null && selectedIndex < photos.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={goNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}

              {/* Image */}
              <img
                src={selectedPhoto.image_url}
                alt={selectedPhoto.caption || "Photo"}
                className="w-full max-h-[75vh] object-contain"
              />

              {/* Bottom bar */}
              <div className="px-4 py-3 flex items-center justify-between bg-black/80">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-1.5 text-white hover:bg-white/20",
                      selectedPhoto.liked_by_me && "text-red-400"
                    )}
                    onClick={() => handleLike(selectedPhoto)}
                    disabled={!isAuthenticated}
                  >
                    <Heart className={cn("h-4 w-4", selectedPhoto.liked_by_me && "fill-current")} />
                    {selectedPhoto.like_count || 0}
                  </Button>
                  {selectedPhoto.caption && (
                    <p className="text-sm text-white/80 truncate max-w-xs">{selectedPhoto.caption}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">
                    {formatDistanceToNow(new Date(selectedPhoto.created_at), { addSuffix: true })}
                  </span>
                  {isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(selectedPhoto.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
