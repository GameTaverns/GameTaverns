import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ExternalLink } from "@/components/a11y/ExternalLink";
import cbgLogo from "@/assets/cbg-logo.png";

const BGG_LOGO_SRC = "/bgg-logo.svg";

export const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  

  return (
    <footer ref={ref} className="border-t bg-card/50">
      <div className="container py-3 px-4">
        <div className="flex flex-nowrap items-center justify-center gap-x-2.5 text-muted-foreground overflow-x-auto whitespace-nowrap" style={{ fontSize: '0.7125rem' }}>
          {/* Copyright + LLC */}
          <span>© {currentYear} GameTaverns LLC</span>
          <span className="text-muted-foreground/40">·</span>
          <ExternalLink href="mailto:admin@gametaverns.com" className="hover:text-foreground transition-colors">{t('footer.contact')}</ExternalLink>
          <span className="text-muted-foreground/40">·</span>
          <ExternalLink href="https://discord.gg/jTqgCPX8DD" className="hover:text-foreground transition-colors">{t('footer.discord')}</ExternalLink>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/legal" className="hover:text-foreground transition-colors">{t('footer.allPolicies')}</Link>
          <span className="text-muted-foreground/40">·</span>
          <ExternalLink
            href="https://boardgamegeek.com"
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            title="Game data powered by BoardGameGeek"
          >
            <img src={BGG_LOGO_SRC} alt="BoardGameGeek" className="h-3.5 w-3.5 object-contain" loading="lazy" />
            {t('footer.poweredByBGG')}
          </ExternalLink>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground/70 italic">All photographs are property of their respective owners.</span>

          {/* CBG badge */}
          <span className="text-muted-foreground/40">·</span>
          <div className="flex items-center gap-1.5">
            <img src={cbgLogo} alt="Christian Board Gamers" className="h-5 w-5 rounded object-contain" loading="lazy" />
            <span>Proud member of Christian Board Gamers</span>
            <ExternalLink href="https://discord.gg/g5N8S6zPMR" className="text-primary hover:underline">Discord</ExternalLink>
            <ExternalLink href="https://www.facebook.com/groups/christianboardgamers" className="text-primary hover:underline">Facebook</ExternalLink>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
