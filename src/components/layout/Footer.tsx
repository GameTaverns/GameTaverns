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
      <div className="container py-8 px-4">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <img src="/gt-logo.png" alt="GameTaverns" className="h-6 w-6 object-contain" />
              <span className="font-display font-bold text-lg">GameTaverns</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              The platform for board game enthusiasts to catalog, share, and celebrate their
              collections with friends and gaming communities.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="font-semibold mb-3">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/press"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Press Kit
                </a>
              </li>
              <li>
                <a
                  href="mailto:admin@gametaverns.com"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="font-semibold mb-3">Community</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://discord.gg/d6PywfxNG4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Join our Discord
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/legal" className="text-muted-foreground hover:text-foreground transition-colors">
                  All Policies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright & Attribution */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {currentYear} GameTaverns LLC. Made with ❤️ for board game enthusiasts.
            </p>

            {/* Only show attributions on self-hosted */}
            {showAttributions && (
              <div className="flex items-center gap-6">
                {/* Love Thy Nerd Attribution - Hidden until official permission granted */}
                {/* TODO: Uncomment when LTN permission is obtained
                <a
                  href="https://lovethynerd.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity text-xs text-muted-foreground font-medium"
                  title="Love Thy Nerd"
                >
                  <img
                    src={LTN_LOGO_SRC}
                    alt="Love Thy Nerd"
                    className="h-6 w-6 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement)?.classList.add('hidden');
                    }}
                  />
                  <span>Love Thy Nerd</span>
                </a>
                */}

                {/* BGG Attribution - Required for API usage */}
                <a
                  href="https://boardgamegeek.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity text-xs text-muted-foreground font-medium"
                  title="Game data powered by BoardGameGeek"
                >
                  <img
                    src={BGG_LOGO_SRC}
                    alt="BoardGameGeek"
                    className="h-6 w-6 object-contain"
                    loading="lazy"
                  />
                  <span>Powered by BGG</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
