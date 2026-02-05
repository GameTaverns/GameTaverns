import { Link } from "react-router-dom";
import { Dices } from "lucide-react";
import { proxiedImageUrl } from "@/lib/utils";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card/50 pb-12">
      <div className="container py-8 px-4">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <Dices className="h-6 w-6 text-primary" />
              <span className="font-display font-bold text-lg">GameTaverns</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              The platform for board game enthusiasts to catalog, share, and celebrate 
              their collections with friends and gaming communities.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="font-semibold mb-3">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:support@gametaverns.com" 
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
            {/* BGG Attribution - Required for API usage */}
            <a 
              href="https://boardgamegeek.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Game data powered by BoardGameGeek"
            >
              <img 
                src={proxiedImageUrl("https://cf.geekdo-images.com/images/geekdo/bgg_logo.png") || "https://cf.geekdo-static.com/images/geekdo/bgg_logo.png"}
                alt="Powered by BoardGameGeek" 
                className="h-6"
              />
              <span className="text-xs text-muted-foreground">Powered by BGG</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
