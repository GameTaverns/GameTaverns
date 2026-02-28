import { useRef, useState } from "react";
import { Camera, Upload, Loader2, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useUploadPhoto } from "@/hooks/usePhotoGallery";
import { toast } from "@/hooks/use-toast";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_DURATION = 120; // 2 minutes
const MAX_FILES = 10;

interface FilePreview {
  file: File;
  url: string;
}

export function PhotoUploadButton() {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const validFiles: FilePreview[] = [];
    for (const f of selectedFiles) {
      if (previews.length + validFiles.length >= MAX_FILES) {
        toast({ title: `Max ${MAX_FILES} files`, variant: "destructive" });
        break;
      }
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");

      if (!isImage && !isVideo) {
        toast({ title: "Invalid file", description: `${f.name} is not an image or video`, variant: "destructive" });
        continue;
      }

      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (f.size > maxSize) {
        toast({ title: "File too large", description: `${f.name} exceeds ${isVideo ? "100MB" : "10MB"}`, variant: "destructive" });
        continue;
      }

      // Check video duration
      if (isVideo) {
        const duration = await getVideoDuration(f);
        if (duration > MAX_VIDEO_DURATION) {
          toast({ title: "Video too long", description: `${f.name} exceeds 2 minutes`, variant: "destructive" });
          continue;
        }
      }

      validFiles.push({ file: f, url: URL.createObjectURL(f) });
    }

    setPreviews(prev => [...prev, ...validFiles]);
    if (fileRef.current) fileRef.current.value = "";
  };

  function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    });
  }

  const removePreview = (index: number) => {
    setPreviews(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = () => {
    if (!previews.length) return;
    uploadPhoto.mutate(
      { files: previews.map(p => p.file), caption: caption.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: previews.length > 1 ? `${previews.length} photos posted!` : "Photo posted!" });
          setOpen(false);
          reset();
        },
        onError: (err) => {
          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const reset = () => {
    previews.forEach(p => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setCaption("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          Post Media
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Post Media</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {previews.map((p, i) => {
                const isVideo = p.file.type.startsWith("video/");
                return (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                    {isVideo ? (
                      <>
                        <video src={p.url} className="w-full h-full object-cover" muted preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/50 rounded-full p-1.5">
                            <Play className="h-4 w-4 text-white fill-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img src={p.url} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => removePreview(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {previews.length < MAX_FILES && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {previews.length === 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to select photos or videos</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <div>
            <Label htmlFor="caption" className="text-sm">Caption (optional)</Label>
            <Textarea
              id="caption"
              placeholder="What's in this photo?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              className="mt-1"
              rows={2}
            />
          </div>
          <Button
            className="w-full"
            disabled={!previews.length || uploadPhoto.isPending}
            onClick={handleSubmit}
          >
            {uploadPhoto.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading {previews.length} file{previews.length > 1 ? "s" : ""}…
              </>
            ) : (
              `Post ${previews.length || ""} File${previews.length > 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
