import { useState, useRef } from "react";
import { Heart, Trash2, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { UserPhoto } from "@/hooks/usePhotoGallery";
import { useTogglePhotoLike, useDeletePhoto } from "@/hooks/usePhotoGallery";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { MentionRenderer } from "@/components/photos/MentionRenderer";

interface PhotoGalleryGridProps {
  photos: UserPhoto[];
  isOwnProfile: boolean;
}

export function PhotoGalleryGrid({ photos, isOwnProfile }: PhotoGalleryGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const toggleLike = useTogglePhotoLike();
  const deletePhoto = useDeletePhoto();
  const { isAuthenticated } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

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
        toast({ title: "Deleted" });
        setSelectedIndex(null);
      },
    });
  };

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {isOwnProfile ? "You haven't posted any media yet." : "No media yet."}
      </p>
    );
  }

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        {photos.map((photo, idx) => {
          const isVideo = photo.media_type === "video";
          const thumbSrc = isVideo ? (photo.thumbnail_url || photo.image_url) : photo.image_url;

          return (
            <button
              key={photo.id}
              onClick={() => setSelectedIndex(idx)}
              className="relative aspect-square overflow-hidden rounded-sm group bg-muted"
            >
              {isVideo && photo.thumbnail_url ? (
                <img
                  src={thumbSrc}
                  alt={photo.caption || "Video thumbnail"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : isVideo ? (
                <video
                  src={photo.image_url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  src={photo.image_url}
                  alt={photo.caption || "Photo"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              )}

              {/* Video play badge */}
              {isVideo && (
                <div className="absolute top-1.5 left-1.5 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-white text-sm font-medium">
                  <Heart className="h-4 w-4 fill-white" />
                  {photo.like_count || 0}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none gap-0 [&>button]:hidden">
          {selectedPhoto && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="h-5 w-5" />
              </Button>

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

              {/* Media content */}
              {selectedPhoto.media_type === "video" ? (
                <video
                  ref={videoRef}
                  src={selectedPhoto.image_url}
                  controls
                  playsInline
                  className="w-full max-h-[75vh] object-contain bg-black"
                  poster={selectedPhoto.thumbnail_url || undefined}
                />
              ) : (
                <img
                  src={selectedPhoto.image_url}
                  alt={selectedPhoto.caption || "Photo"}
                  className="w-full max-h-[75vh] object-contain"
                />
              )}

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
                    <MentionRenderer caption={selectedPhoto.caption} className="text-sm text-white/80 truncate max-w-xs" />
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
