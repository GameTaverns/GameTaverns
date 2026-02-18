import { useState, useRef } from "react";
import { ImageIcon, Link, Loader2, X, Upload, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateUserProfile } from "@/hooks/useLibrary";
import { supabase, isSelfHostedMode, isSelfHostedSupabaseStack, apiClient } from "@/integrations/backend/client";

const GRADIENT_PRESETS = [
  "linear-gradient(135deg, hsl(var(--primary)/0.5), hsl(var(--accent)/0.3))",
  "linear-gradient(135deg, #1a1a2e, #16213e)",
  "linear-gradient(135deg, #2d1b69, #11998e)",
  "linear-gradient(135deg, #373b44, #4286f4)",
  "linear-gradient(135deg, #834d9b, #d04ed6)",
  "linear-gradient(135deg, #1a3a4a, #2e7d52)",
  "linear-gradient(135deg, #4a1a1a, #8b3a3a)",
];

interface BannerUploadProps {
  currentBannerUrl: string | null;
}

export function BannerUpload({ currentBannerUrl }: BannerUploadProps) {
  const { user } = useAuth();
  const updateProfile = useUpdateUserProfile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const saveBannerUrl = async (url: string | null) => {
    try {
      await updateProfile.mutateAsync({ banner_url: url } as any);
      setPopoverOpen(false);
      toast({ title: "Banner updated", description: url ? "Your profile banner has been saved." : "Banner removed." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message || "Could not save banner", variant: "destructive" });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Use JPEG, PNG, GIF, or WebP", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 8MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/banner.${ext}`;

      // Get session token for self-hosted storage auth
      const { data: { session } } = await supabase.auth.getSession();
      const config = (window as any).__RUNTIME_CONFIG__;
      const storageUrl = config?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
      const anonKey = config?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      const token = session?.access_token || anonKey;

      if (storageUrl && token) {
        // Self-hosted: use direct fetch with proper auth
        const uploadEndpoint = `${storageUrl}/storage/v1/object/avatars/${filePath}`;
        const res = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type,
            'x-upsert': 'true',
          },
          body: file,
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || `Upload failed: ${res.status}`);
        }
        const publicUrl = `${storageUrl}/storage/v1/object/public/avatars/${filePath}`;
        await saveBannerUrl(publicUrl);
      } else {
        // Cloud fallback
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        await saveBannerUrl(publicUrl);
      }
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Could not upload banner", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    try { new URL(urlInput.trim()); } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid image URL", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      await saveBannerUrl(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update banner", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const bannerStyle = currentBannerUrl
    ? { backgroundImage: `url(${currentBannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(var(--accent)/0.2))" };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Profile Banner
      </Label>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative group w-full h-24 rounded-lg border border-border overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={bannerStyle}
            disabled={isUploading}
          >
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {isUploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <>
                  <ImageIcon className="h-5 w-5 text-white" />
                  <span className="text-white text-sm font-medium">Change Banner</span>
                </>
              )}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
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

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Palette className="h-3 w-3" /> Or use a gradient preset:
              </p>
              <div className="grid grid-cols-7 gap-1">
                {GRADIENT_PRESETS.map((gradient, i) => (
                  <button
                    key={i}
                    className="h-6 w-full rounded border border-border hover:scale-110 transition-transform focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    style={{ background: gradient }}
                    onClick={() => saveBannerUrl(`__gradient__${gradient}`)}
                    disabled={isUploading}
                    title={`Gradient ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {currentBannerUrl && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={() => saveBannerUrl(null)}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
                Remove banner
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        Upload a photo or choose a gradient. JPG, PNG, GIF, WebP up to 8MB.
      </p>
    </div>
  );
}
