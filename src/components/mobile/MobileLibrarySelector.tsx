import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, LogIn, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { useMobileLibrary } from "@/hooks/useCapacitor";
import logoImage from "@/assets/logo.png";

interface MobileLibrarySelectorProps {
  onLibrarySelected?: (slug: string) => void;
}

export function MobileLibrarySelector({ onLibrarySelected }: MobileLibrarySelectorProps) {
  const [librarySlug, setLibrarySlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLibrarySearch, setShowLibrarySearch] = useState(false);
  const { selectLibrary } = useMobileLibrary();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = librarySlug.toLowerCase().trim();
    if (!slug) {
      toast.error("Please enter a library name");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("libraries_public")
        .select("slug, name, is_active")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        toast.error("Library not found", {
          description: "Please check the library name and try again.",
        });
        return;
      }

      if (!data.is_active) {
        toast.error("Library is not available", {
          description: "This library is currently suspended.",
        });
        return;
      }

      await selectLibrary(slug);
      toast.success(`Connected to ${data.name}`);

      if (onLibrarySelected) {
        onLibrarySelected(slug);
      } else {
        // Navigate in-app using query param routing (works on native Capacitor)
        navigate(`/?tenant=${slug}`, { replace: true });
      }
    } catch (err) {
      console.error("Error checking library:", err);
      toast.error("Failed to connect to library");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex flex-col items-center justify-center p-6">
      {/* Logo + Title */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <img src={logoImage} alt="GameTaverns" className="h-20 w-auto drop-shadow-lg" />
        <h1 className="font-display text-3xl font-bold text-foreground tracking-wide">
          GameTaverns
        </h1>
        <p className="text-muted-foreground text-sm text-center font-body">
          Your board game library companion
        </p>
      </div>

      {/* Primary action: Sign In */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          className="w-full font-display text-base bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-md"
          size="lg"
          onClick={() => navigate("/login")}
        >
          <LogIn className="mr-2 h-5 w-5" />
          Sign In
        </Button>

        {/* Divider */}
        <div className="relative flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-body">or browse a library</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Library search — collapsed by default */}
        {!showLibrarySearch ? (
          <Button
            variant="outline"
            className="w-full font-body text-muted-foreground border-border/60"
            onClick={() => setShowLibrarySearch(true)}
          >
            <ChevronDown className="mr-2 h-4 w-4" />
            Browse without an account
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 bg-card/80 border border-border/50 rounded-xl p-4 backdrop-blur-sm">
            <div className="space-y-1.5">
              <Label htmlFor="librarySlug" className="text-foreground/80 font-body text-sm">
                Library Name
              </Label>
              <Input
                id="librarySlug"
                placeholder="e.g., boardgame-cafe"
                value={librarySlug}
                onChange={(e) => setLibrarySlug(e.target.value)}
                className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground font-body">
                Found in the URL:{" "}
                <span className="font-mono text-foreground/70">library-name</span>.gametaverns.com
              </p>
            </div>

            <Button
              type="submit"
              variant="outline"
              className="w-full font-display"
              disabled={isLoading || !librarySlug.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-muted-foreground/60 text-center font-body">
        © {new Date().getFullYear()} GameTaverns
      </p>
    </div>
  );
}
