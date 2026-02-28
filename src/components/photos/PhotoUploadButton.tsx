import { useRef, useState } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function PhotoUploadButton() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = () => {
    if (!file) return;
    uploadPhoto.mutate(
      { file, caption: caption.trim() || undefined },
      {
        onSuccess: () => {
          toast({ title: "Photo posted!" });
          setOpen(false);
          setFile(null);
          setPreview(null);
          setCaption("");
        },
        onError: (err) => {
          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          Post Photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Post a Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded-md bg-muted"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => { setFile(null); setPreview(null); }}
              >
                Change
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to select a photo</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
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
            disabled={!file || uploadPhoto.isPending}
            onClick={handleSubmit}
          >
            {uploadPhoto.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              "Post Photo"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
