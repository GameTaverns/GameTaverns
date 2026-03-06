import { useState, useRef } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

interface ClubLogoUploadProps {
  clubId: string;
  currentLogoUrl: string | null;
  clubName: string;
  onUploaded: (url: string) => void;
}

export function ClubLogoUpload({ clubId, currentLogoUrl, clubName, onUploaded }: ClubLogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Use JPEG, PNG, GIF, or WebP", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 5MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${clubId}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('club-logos')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('club-logos')
        .getPublicUrl(filePath);

      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      onUploaded(finalUrl);
      toast({ title: "Logo uploaded!" });
    } catch (error: any) {
      console.error("Club logo upload error:", error);
      toast({ title: "Upload failed", description: error.message || "Could not upload logo", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials = clubName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20 border-2 border-wood-medium/50">
        <AvatarImage src={currentLogoUrl || undefined} alt={clubName} />
        <AvatarFallback className="bg-wood-medium/50 text-cream font-display text-xl">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2 text-cream border-secondary/50 hover:bg-wood-medium/50"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {currentLogoUrl ? "Change Logo" : "Upload Logo"}
        </Button>
        <p className="text-[10px] text-cream/40">JPEG, PNG, GIF, WebP · Max 5MB</p>
      </div>
    </div>
  );
}
