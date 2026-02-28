import { useState, useRef } from "react";
import { Camera, Link, Loader2, X, Upload } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateUserProfile } from "@/hooks/useLibrary";
import { supabase } from "@/lib/supabase";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  displayName: string | null;
}

export function AvatarUpload({ currentAvatarUrl, displayName }: AvatarUploadProps) {
  const { user } = useAuth();
  const updateProfile = useUpdateUserProfile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const initials = (displayName || user?.email || "?")
    .split(/[\s@]/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/avatar.${ext}`;

      // Remove old avatar if exists
      await supabase.storage.from('avatars').remove([filePath]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Append cache-busting param so the browser fetches the new image
      await saveAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast({ title: "Upload failed", description: error.message || "Could not upload avatar", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    // Basic URL validation
    try {
      new URL(urlInput.trim());
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid image URL", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      await saveAvatarUrl(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update avatar", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    try {
      await saveAvatarUrl(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove avatar", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const saveAvatarUrl = async (url: string | null) => {
    await updateProfile.mutateAsync({ avatar_url: url });
    setPopoverOpen(false);
    toast({ title: "Avatar updated", description: url ? "Your new avatar has been saved." : "Avatar removed." });
  };

  return (
    <div className="flex items-center gap-4">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative group cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isUploading}
          >
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={currentAvatarUrl || undefined} alt="Your avatar" />
              <AvatarFallback className="text-xl font-display bg-primary/20 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />

            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4" />
              Upload image
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => setShowUrlInput(!showUrlInput)}
              disabled={isUploading}
            >
              <Link className="h-4 w-4" />
              Paste image URL
            </Button>

            {showUrlInput && (
              <div className="flex gap-1 pt-1">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="text-xs h-8"
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                />
                <Button size="sm" className="h-8 px-2" onClick={handleUrlSubmit} disabled={isUploading || !urlInput.trim()}>
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set"}
                </Button>
              </div>
            )}

            {currentAvatarUrl && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={handleRemoveAvatar}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
                Remove avatar
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Profile Photo</p>
        <p>Click to upload or paste a URL</p>
        <p className="text-xs">JPG, PNG, GIF, or WebP. Max 5MB.</p>
      </div>
    </div>
  );
}

