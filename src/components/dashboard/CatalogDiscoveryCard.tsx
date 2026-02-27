import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus, X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "catalog_discovery_dismissed";

/**
 * Dismissible card that introduces users to the catalog and the 1-click add feature.
 * Shows on the Dashboard library tab. Once dismissed, never shows again.
 */
export function CatalogDiscoveryCard() {
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(STORAGE_KEY)
  );

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-4"
        >
          <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
            {/* Decorative accent */}
            <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l" />

            <CardContent className="py-4 pl-5 pr-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0 mt-0.5">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Browse the Game Catalog
                    </h3>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We have a catalog of thousands of board games. Find any game and tap the{" "}
                    <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                      <Plus className="h-3 w-3" /> button
                    </span>{" "}
                    to instantly add it to your library — no manual entry needed!
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Link to="/catalog">
                      <Button size="sm" className="h-7 text-xs gap-1.5">
                        <BookOpen className="h-3 w-3" />
                        Browse Catalog
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={dismiss}
                    >
                      Got it
                    </Button>
                  </div>
                </div>

                <button
                  onClick={dismiss}
                  className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
