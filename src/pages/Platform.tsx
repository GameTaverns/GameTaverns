import { Link, useNavigate } from "react-router-dom";
import { Library, Users, Palette, Shield, Zap, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { usePlatformStats, formatStatNumber } from "@/hooks/usePlatformStats";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import logoImage from "@/assets/logo.png";


export default function Platform() {
  const { isAuthenticated } = useAuth();
  const { data: myLibrary } = useMyLibrary();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (myLibrary) {
        navigate(`/?tenant=${myLibrary.slug}`);
      } else {
        navigate("/create-library");
      }
    } else {
      navigate("/signup");
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-dark via-sidebar to-wood-medium">
      {/* Header */}
      <header className="border-b border-border/30 bg-wood-dark/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImage} alt="GameTaverns" className="h-10 w-auto" />
            <span className="font-display text-2xl font-bold text-cream">
              GameTaverns
            </span>
          </Link>
          
          <nav className="flex items-center gap-4">
            <FeedbackDialog />
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="text-cream/80 hover:text-cream hover:bg-wood-medium/50">
                    Dashboard
                  </Button>
                </Link>
                {myLibrary && (
                  <Link to={`/?tenant=${myLibrary.slug}`}>
                    <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                      My Library
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <>
              <Link to="/login">
                  <Button variant="ghost" className="text-cream/80 hover:text-cream hover:bg-wood-medium/50">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-5xl md:text-7xl font-bold text-cream mb-6">
          Your Board Game Collection,
          <br />
          <span className="text-secondary">Beautifully Organized</span>
        </h1>
        <p className="text-xl text-cream/70 max-w-2xl mx-auto mb-10">
          Create your own personalized board game library. Track your collection, 
          log play sessions, share with friends, and make it uniquely yours.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8 py-6"
            onClick={handleGetStarted}
          >
            {isAuthenticated ? (myLibrary ? "Go to My Library" : "Create Your Library") : "Start Free"}
          </Button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16">
          <div>
            <div className="text-3xl font-bold text-secondary">
              {statsLoading ? "..." : formatStatNumber(stats?.librariesCount || 0)}
            </div>
            <div className="text-cream/50 text-sm">Libraries Created</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">
              {statsLoading ? "..." : formatStatNumber(stats?.gamesCount || 0)}
            </div>
            <div className="text-cream/50 text-sm">Games Cataloged</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-secondary">
              {statsLoading ? "..." : formatStatNumber(stats?.playsCount || 0)}
            </div>
            <div className="text-cream/50 text-sm">Plays Logged</div>
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl font-bold text-cream text-center mb-12">
          Everything You Need
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Library className="h-8 w-8" />}
            title="Your Personal Library"
            description="Catalog your entire collection with details from BoardGameGeek. Track condition, location, and more."
          />
          <FeatureCard 
            icon={<Palette className="h-8 w-8" />}
            title="Fully Customizable"
            description="Make it yours with custom colors, backgrounds, fonts, and branding. Your library, your style."
          />
          <FeatureCard 
            icon={<Users className="h-8 w-8" />}
            title="Share with Friends"
            description="Give friends a link to browse your collection. They can wishlist games and request to borrow."
          />
          <FeatureCard 
            icon={<Zap className="h-8 w-8" />}
            title="Play Logging"
            description="Track game sessions, winners, scores, and notes. See your play stats and history."
          />
          <FeatureCard 
            icon={<Shield className="h-8 w-8" />}
            title="Private by Default"
            description="Control what's public and what's private. Admin data stays hidden from visitors."
          />
          <FeatureCard 
            icon={<Upload className="h-8 w-8" />}
            title="Easy Import"
            description="Import your collection via CSV or add games individually with automatic box art and details."
          />
        </div>
      </section>
      
      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="bg-wood-medium/30 rounded-2xl p-12 border border-border/30">
          <h2 className="font-display text-3xl font-bold text-cream mb-4">
            Ready to Create Your Library?
          </h2>
          <p className="text-cream/70 mb-8 max-w-xl mx-auto">
            Join thousands of board game enthusiasts who trust GameTaverns to organize and showcase their collections.
          </p>
          <Button 
            size="lg" 
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8"
            onClick={handleGetStarted}
          >
            Get Started Free
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-border/30 bg-wood-dark/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-cream/50 text-sm">
              &copy; {new Date().getFullYear()} GameTaverns. A hobby project made with ❤️ for board game enthusiasts.
            </p>
            <nav className="flex gap-6 text-sm">
              <Link to="/privacy" className="text-cream/50 hover:text-cream transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="text-cream/50 hover:text-cream transition-colors">
                Terms
              </Link>
              <Link to="/cookies" className="text-cream/50 hover:text-cream transition-colors">
                Cookies
              </Link>
              <Link to="/legal" className="text-cream/50 hover:text-cream transition-colors">
                Legal
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-wood-medium/20 rounded-xl p-6 border border-border/20">
      <div className="text-secondary mb-4">{icon}</div>
      <h3 className="font-display text-xl font-semibold text-cream mb-2">{title}</h3>
      <p className="text-cream/60">{description}</p>
    </div>
  );
}
