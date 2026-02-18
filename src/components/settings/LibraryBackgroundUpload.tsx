import { useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/backend/client";

interface LibraryBackgroundUploadProps {
  libraryId: string;
  currentUrl: string | null;
  onUrlChange: (url: string | null) => void;
}

export function LibraryBackgroundUpload({
  libraryId,
  currentUrl,
  onUrlChange,
}: LibraryBackgroundUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Use JPEG, PNG, or WebP", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 8MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${libraryId}/background.${ext}`;

      // Get session token for direct fetch (works in both cloud and self-hosted)
      const { data: { session } } = await supabase.auth.getSession();
      const config = (window as any).__RUNTIME_CONFIG__;
      const storageUrl = config?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
      const anonKey = config?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      const token = session?.access_token || anonKey;

      if (!storageUrl) {
        throw new Error("Storage URL not configured");
      }
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Use direct fetch with x-upsert to handle both insert and update
      const uploadEndpoint = `${storageUrl}/storage/v1/object/library-logos/${filePath}`;
      const res = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "x-upsert": "true",
        },
        body: file,
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Upload failed (${res.status})`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.message || errJson.error || errMsg;
        } catch {
          if (errText) errMsg = errText;
        }
        throw new Error(errMsg);
      }

      const publicUrl = `${storageUrl}/storage/v1/object/public/library-logos/${filePath}`;
      onUrlChange(publicUrl);
      toast({ title: "Background uploaded", description: "Library background image updated." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Could not upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    try { new URL(urlInput.trim()); } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid image URL", variant: "destructive" });
      return;
    }
    onUrlChange(urlInput.trim());
    setUrlInput("");
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Preview */}
      {currentUrl && (
        <div
          className="h-40 rounded-md border bg-cover bg-center relative group"
          style={{ backgroundImage: `url(${currentUrl})` }}
        >
          <Button
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
            onClick={() => onUrlChange(null)}
          >
            <X className="h-3 w-3 mr-1" /> Remove
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload Image
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
          disabled={isUploading}
        >
          <Link className="h-4 w-4 mr-2" />
          Paste URL
        </Button>
      </div>

      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/background.jpg"
            className="text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          />
          <Button size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            Set
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Upload or link a high-resolution image. JPEG, PNG, WebP up to 8MB.
      </p>
    </div>
  );
}
