import { useState, useEffect } from "react";
import { Shield, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTotpStatus } from "@/hooks/useTotpStatus";
import { motion, AnimatePresence } from "framer-motion";

export function TwoFactorBanner() {
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

  // Don't show if loading, already enabled, or dismissed
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
            Secure your account with two-factor authentication
          </p>
          <p className="text-xs text-muted-foreground">
            Add an extra layer of security to protect your account and library data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/setup-2fa">
            <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Set Up 2FA
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
