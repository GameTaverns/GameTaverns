import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isLovableCloud } from "@/config/runtime";
import { ExternalLink } from "@/components/a11y/ExternalLink";
import cbgLogo from "@/assets/cbg-logo.jpg";

const BGG_LOGO_SRC = "/bgg-logo.svg";

export const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const showAttributions = !isLovableCloud();

  return (
    <footer ref={ref} className="border-t bg-card/50">
      <div className="container py-3 px-4 space-y-2">
        {/* Main row */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {/* Left: Brand + links */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <Link to="/" className="flex items-center gap-1.5 text-foreground">
              <img src="/gt-logo.png" alt="GameTaverns" className="h-4 w-4 object-contain" />
              <span className="font-display font-bold">GameTaverns</span>
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <span>{t('footer.copyright', { year: currentYear })}</span>
            <span className="text-muted-foreground/40">·</span>
            <ExternalLink href="mailto:admin@gametaverns.com" className="hover:text-foreground transition-colors">{t('footer.contact')}</ExternalLink>
            <span className="text-muted-foreground/40">·</span>
            <ExternalLink href="https://discord.gg/jTqgCPX8DD" className="hover:text-foreground transition-colors">{t('footer.discord')}</ExternalLink>
            <span className="text-muted-foreground/40">·</span>
            <Link to="/legal" className="hover:text-foreground transition-colors">{t('footer.allPolicies')}</Link>
          </div>

          {/* Right: CBG badge */}
          <div className="flex items-center gap-1.5">
            <img src={cbgLogo} alt="Christian Board Gamers" className="h-6 w-auto rounded" loading="lazy" />
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground leading-tight">Proud member of the</span>
              <span className="text-[10px] font-display font-semibold text-foreground leading-tight">Christian Board Gamers</span>
              <div className="flex items-center gap-1.5">
                <ExternalLink href="https://discord.gg/g5N8S6zPMR" className="text-[9px] text-primary hover:underline">Discord</ExternalLink>
                <ExternalLink href="https://www.facebook.com/groups/christianboardgamers" className="text-[9px] text-primary hover:underline">Facebook</ExternalLink>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: attributions */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/60">
          {showAttributions && (
            <ExternalLink
              href="https://boardgamegeek.com"
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              title="Game data powered by BoardGameGeek"
            >
              <img src={BGG_LOGO_SRC} alt="BoardGameGeek" className="h-3.5 w-3.5 object-contain" loading="lazy" />
              {t('footer.poweredByBGG')}
            </ExternalLink>
          )}
          <span className="italic">All photographs are property of their respective owners.</span>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
