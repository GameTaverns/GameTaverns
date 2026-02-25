import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, LogIn, ChevronDown, Scale, Search } from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import logoImage from "@/assets/logo.png";

interface MobileLibrarySelectorProps {
  onLibrarySelected?: (slug: string) => void;
}

export function MobileLibrarySelector({ onLibrarySelected }: MobileLibrarySelectorProps) {
  const { t } = useTranslation();
  const [librarySlug, setLibrarySlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLibrarySearch, setShowLibrarySearch] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const slug = librarySlug.toLowerCase().trim();
    if (!slug) {
      toast.error(t("mobileStart.enterLibraryName"));
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
        toast.error(t("mobileStart.libraryNotFound"), {
          description: t("mobileStart.libraryNotFoundDesc"),
        });
        return;
      }

      if (!data.is_active) {
        toast.error(t("mobileStart.libraryUnavailable"), {
          description: t("mobileStart.libraryUnavailableDesc"),
        });
        return;
      }

      toast.success(t("mobileStart.connectedTo", { name: data.name }));

      if (onLibrarySelected) {
        onLibrarySelected(slug);
      } else {
        navigate(`/?tenant=${slug}`, { replace: true });
      }
    } catch (err) {
      console.error("Error checking library:", err);
      toast.error(t("mobileStart.connectionFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted dark:from-wood-dark dark:via-sidebar dark:to-wood-medium flex flex-col items-center justify-center p-6 relative">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Logo + Title */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <img src={logoImage} alt="GameTaverns" className="h-20 w-auto drop-shadow-lg" />
        <h1 className="font-display text-3xl font-bold text-foreground tracking-wide">
          GameTaverns
        </h1>
        <p className="text-muted-foreground text-sm text-center font-body">
          {t("mobileStart.tagline")}
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
          {t("nav.signIn")}
        </Button>

        {/* Divider */}
        <div className="relative flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-body">{t("mobileStart.orBrowse")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Library browse — two options */}
        <Button
          variant="outline"
          className="w-full font-body text-muted-foreground border-border/60"
          onClick={() => navigate("/directory")}
        >
          <Search className="mr-2 h-4 w-4" />
          {t("mobileStart.browseDirectory", "Browse Library Directory")}
        </Button>

        {/* Manual slug entry — collapsed */}
        {!showLibrarySearch ? (
          <Button
            variant="ghost"
            className="w-full font-body text-muted-foreground/60 text-xs"
            onClick={() => setShowLibrarySearch(true)}
          >
            <ChevronDown className="mr-2 h-3 w-3" />
            {t("mobileStart.enterManually", "Enter library code manually")}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 bg-card/80 border border-border/50 rounded-xl p-4 backdrop-blur-sm">
            <div className="space-y-1.5">
              <Label htmlFor="librarySlug" className="text-foreground/80 font-body text-sm">
                {t("mobileStart.libraryName")}
              </Label>
              <Input
                id="librarySlug"
                placeholder={t("mobileStart.libraryPlaceholder")}
                value={librarySlug}
                onChange={(e) => setLibrarySlug(e.target.value)}
                className="bg-input border-border/50 text-foreground placeholder:text-muted-foreground"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground font-body">
                {t("mobileStart.urlHint")}{" "}
                <span className="font-mono text-foreground/70">{t("mobileStart.urlExample")}</span>
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
                  {t("mobileStart.connecting")}
                </>
              ) : (
                <>
                  {t("mobileStart.continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <button
          onClick={() => navigate("/legal")}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-1 transition-colors font-body"
        >
          <Scale className="h-3 w-3" />
          {t("legal.title")}
        </button>
        <p className="text-xs text-muted-foreground/60 text-center font-body">
          © {new Date().getFullYear()} GameTaverns
        </p>
      </div>
    </div>
  );
}
