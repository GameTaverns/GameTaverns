import { Link } from "react-router-dom";
import { isLovableCloud } from "@/config/runtime";

const LTN_LOGO_SRC = "/ltn-logo.png";
const BGG_LOGO_SRC = "/bgg-logo.svg";

export function Footer() {
  const currentYear = new Date().getFullYear();
  // Show attributions on self-hosted/production deployments, NOT on Lovable Cloud
  const showAttributions = !isLovableCloud();

  return (
    <footer className="border-t bg-card/50">
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
              © {currentYear} GameTaverns. A hobby project made with ❤️ for board game enthusiasts.
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
}
