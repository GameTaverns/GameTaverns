import { useState, useRef } from "react";
import { Camera, Upload, Loader2, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSubmitCatalogImage, useTrustedSubmitter } from "@/hooks/useCatalogImageSubmissions";
import { useToast } from "@/hooks/use-toast";
import { validateImageFile } from "@/lib/fileValidation";

interface SuggestImageButtonProps {
  catalogId: string;
  gameTitle: string;
  /** Render as a small overlay or standalone button */
  variant?: "overlay" | "button";
}

export function SuggestImageButton({
  catalogId,
  gameTitle,
  variant = "button",
}: SuggestImageButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { data: isTrusted } = useTrustedSubmitter();
  const submit = useSubmitCatalogImage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const handleFile = async (f: File) => {
    setValidationError(null);
    const result = await validateImageFile(f);
    if (!result.valid) {
      setValidationError(result.error || "Invalid file");
      setFile(null);
      setPreview(null);
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      const result = await submit.mutateAsync({ file, catalogId });
      if (result.autoApproved) {
        toast({ title: "Image updated!", description: "Your image has been applied to the catalog." });
      } else {
        toast({ title: "Image submitted for review", description: "An admin will review your submission shortly." });
      }
      setOpen(false);
      setFile(null);
      setPreview(null);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
    setValidationError(null);
  };

  const trigger =
    variant === "overlay" ? (
      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg gap-1.5"
      >
        <Camera className="h-3.5 w-3.5" />
        <span className="text-xs">Suggest Image</span>
      </Button>
    ) : (
      <Button variant="outline" size="sm" className="gap-1.5">
        <Camera className="h-3.5 w-3.5" />
        Suggest Better Image
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suggest Image for {gameTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Trust tier info */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              {isTrusted
                ? "You're a trusted submitter — your images are auto-approved!"
                : "Your image will be reviewed by an admin before going live. After 3 approved submissions, your images will be auto-approved."}
            </span>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {preview ? (
              <div className="space-y-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                <p className="text-sm text-muted-foreground">
                  {file?.name} • Click to change
                </p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop an image here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, or WebP • Max 10 MB
                </p>
              </>
            )}
          </div>

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submit.isPending || !file}
            >
              {submit.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
