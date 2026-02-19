import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AchievementsDisplay } from "@/components/achievements/AchievementsDisplay";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPlatformUrl } from "@/hooks/useTenantUrl";
import { TenantLink } from "@/components/TenantLink";
import logoImage from "@/assets/logo.png";

export default function Achievements() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium dark">
      {/* Header */}
      <header className="border-b border-wood-medium/50 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImage} alt="GameTaverns" className="h-10 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">
              GameTaverns
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <TenantLink href={getPlatformUrl("/dashboard")}>
              <Button variant="outline" className="gap-2 border-wood-medium/50 text-cream hover:bg-wood-medium/30">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </TenantLink>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border p-6 md:p-8">
            <AchievementsDisplay compact={false} />
          </div>
        </div>
      </main>
    </div>
  );
}
