import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LogoUploadProps {
  libraryId: string;
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

export function LogoUpload({ libraryId, currentLogoUrl, onLogoChange }: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PNG, JPEG, WebP, or SVG image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be under 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${libraryId}/logo.${fileExt}`;

      // Delete existing logo if present
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/library-logos/')[1];
        if (oldPath) {
          await supabase.storage.from('library-logos').remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('library-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('library-logos')
        .getPublicUrl(fileName);

      // Add cache-busting parameter
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      
      setPreviewUrl(urlWithCacheBust);
      onLogoChange(publicUrl);

      toast({
        title: "Logo uploaded",
        description: "Your library logo has been updated",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setIsUploading(true);

    try {
      const path = currentLogoUrl.split('/library-logos/')[1]?.split('?')[0];
      if (path) {
        const { error } = await supabase.storage.from('library-logos').remove([path]);
        if (error) throw error;
      }

      setPreviewUrl(null);
      onLogoChange(null);

      toast({
        title: "Logo removed",
        description: "Your library logo has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove logo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label>Library Logo</Label>
      
      <div className="flex items-start gap-6">
        {/* Preview */}
        <div className="w-32 h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center overflow-hidden bg-muted/50">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Library logo" 
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3 flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {previewUrl ? "Replace Logo" : "Upload Logo"}
          </Button>

          {previewUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveLogo}
              disabled={isUploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove Logo
            </Button>
          )}

          <p className="text-sm text-muted-foreground">
            PNG, JPEG, WebP, or SVG. Max 2MB. Recommended: 200×200px or larger.
          </p>
        </div>
      </div>
    </div>
  );
}
