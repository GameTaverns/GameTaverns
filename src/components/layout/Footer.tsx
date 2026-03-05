import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { isLovableCloud } from "@/config/runtime";

const LTN_LOGO_SRC = "/ltn-logo.png";
const BGG_LOGO_SRC = "/bgg-logo.svg";

export const Footer = forwardRef<HTMLElement>((_, ref) => {
  const currentYear = new Date().getFullYear();
  // Show attributions on self-hosted/production deployments, NOT on Lovable Cloud
  const showAttributions = !isLovableCloud();

  return (
    <footer ref={ref} className="border-t bg-card/50">
      <div className="container py-4 px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Brand + Links */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to="/" className="flex items-center gap-2">
              <img src="/gt-logo.png" alt="GameTaverns" className="h-5 w-5 object-contain" />
              <span className="font-display font-bold text-sm">GameTaverns</span>
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <a href="/press" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Press</a>
            <a href="mailto:admin@gametaverns.com" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            <a
              href="https://discord.gg/jTqgCPX8DD"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Discord
            </a>
          </div>

          {/* Legal — inline */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</Link>
            <Link to="/legal" className="text-muted-foreground hover:text-foreground transition-colors">All Policies</Link>
          </div>
        </div>

        {/* Copyright & Attribution — compact */}
        <div className="mt-3 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {currentYear} GameTaverns LLC. Made with ❤️ for board game enthusiasts.
          </p>
          {showAttributions && (
            <div className="flex items-center gap-3">
              <a
                href="https://boardgamegeek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-xs text-muted-foreground"
                title="Game data powered by BoardGameGeek"
              >
                <img src={BGG_LOGO_SRC} alt="BoardGameGeek" className="h-4 w-4 object-contain" loading="lazy" />
                Powered by BGG
              </a>
              <span className="text-[10px] text-muted-foreground/50">Images © their publishers.</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
