import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Share2, Copy, Check, ExternalLink, Code, QrCode, Twitter, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface ShareLibraryDialogProps {
  libraryName: string;
  librarySlug: string;
  gameCount?: number;
  memberCount?: number;
  logoUrl?: string | null;
  trigger?: React.ReactNode;
}

export function ShareLibraryDialog({
  libraryName,
  librarySlug,
  gameCount = 0,
  memberCount = 0,
  logoUrl,
  trigger,
}: ShareLibraryDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);

  const libraryUrl = `https://${librarySlug}.gametaverns.com`;
  const embedCode = `<iframe src="${libraryUrl}/embed" width="100%" height="600" frameborder="0" style="border-radius:12px;border:1px solid #333;" title="${libraryName} - Board Game Collection"></iframe>`;
  const embedScript = `<script src="https://gametaverns.com/embed.js" data-library="${librarySlug}"></script>`;

  const shareText = `Check out ${libraryName}'s board game collection on GameTaverns! ${gameCount} games to explore.`;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const socialLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(libraryUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(libraryUrl)}&quote=${encodeURIComponent(shareText)}`,
    reddit: `https://reddit.com/submit?url=${encodeURIComponent(libraryUrl)}&title=${encodeURIComponent(`${libraryName} — Board Game Collection`)}`,
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {libraryName}
          </DialogTitle>
        </DialogHeader>

        {/* Preview Card */}
        <div className="rounded-xl bg-gradient-to-br from-primary/20 via-background to-accent/10 border p-4 space-y-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={libraryName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {libraryName.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-display font-bold text-sm">{libraryName}</h3>
              <p className="text-xs text-muted-foreground">Board Game Collection on GameTaverns</p>
            </div>
          </div>
          <div className="flex gap-3">
            {gameCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                🎲 {gameCount} games
              </Badge>
            )}
            {memberCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                👥 {memberCount} members
              </Badge>
            )}
          </div>
        </div>

        {/* Copy Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Library Link</label>
          <div className="flex gap-2">
            <Input
              value={libraryUrl}
              readOnly
              className="text-sm font-mono bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(libraryUrl, "Link")}
              className="shrink-0"
            >
              {copied === "Link" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Social Share Buttons */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Share on Social</label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-1"
              onClick={() => window.open(socialLinks.twitter, "_blank", "width=550,height=420")}
            >
              <Twitter className="h-4 w-4" />
              Twitter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-1"
              onClick={() => window.open(socialLinks.facebook, "_blank", "width=550,height=420")}
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-1"
              onClick={() => window.open(socialLinks.reddit, "_blank", "width=550,height=420")}
            >
              <MessageCircle className="h-4 w-4" />
              Reddit
            </Button>
          </div>

          {/* Native share (mobile) */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full gap-2"
              onClick={async () => {
                try {
                  await navigator.share({
                    title: `${libraryName} — Board Game Collection`,
                    text: shareText,
                    url: libraryUrl,
                  });
                } catch {
                  // User cancelled
                }
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Share via...
            </Button>
          )}
        </div>

        <Separator />

        {/* Embed Code */}
        <div className="space-y-2">
          <button
            onClick={() => setShowEmbed(!showEmbed)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Code className="h-4 w-4" />
            Embed on your website
          </button>
          {showEmbed && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Script tag (recommended)</label>
                <div className="flex gap-2">
                  <Input
                    value={embedScript}
                    readOnly
                    className="text-xs font-mono bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleCopy(embedScript, "Embed script")}
                  >
                    {copied === "Embed script" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">iFrame (alternative)</label>
                <div className="flex gap-2">
                  <Input
                    value={embedCode}
                    readOnly
                    className="text-xs font-mono bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleCopy(embedCode, "iFrame code")}
                  >
                    {copied === "iFrame code" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Add this to your website to show your board game collection. Perfect for cafés and game stores!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
