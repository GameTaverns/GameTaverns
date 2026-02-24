import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo.png";

/**
 * Shared header for public pages: landing, legal, privacy, terms, cookies, features, etc.
 * Shows logo, sign in/up, theme toggle, and language switcher.
 */
export function PublicHeader() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <header className="border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 min-w-0 flex-shrink-1">
          <img src={logoImage} alt="GameTaverns" className="h-8 w-auto flex-shrink-0" />
          <span className="font-display text-lg sm:text-2xl font-bold text-foreground truncate">
            GameTaverns
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {t("nav.dashboard")}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  {t("nav.signIn")}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  {t("signup.createAccount")}
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
