import { useState, useEffect } from "react";
import { Shield, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useTotpStatus } from "@/hooks/useTotpStatus";
import { motion, AnimatePresence } from "framer-motion";

export function TwoFactorBanner() {
  const { t } = useTranslation();
  const { status, loading } = useTotpStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("2fa_banner_dismissed");
    if (isDismissed === "true") setDismissed(true);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("2fa_banner_dismissed", "true");
    setDismissed(true);
  };

  if (loading || status?.isEnabled || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-secondary/15 border border-secondary/30 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap"
      >
        <Shield className="h-5 w-5 text-secondary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t('twoFactor.bannerTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('twoFactor.bannerDesc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/setup-2fa">
            <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {t('twoFactor.setUp2FA')}
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
