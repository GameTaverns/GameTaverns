import { Link } from "react-router-dom";
import { 
  Library, 
  Users, 
  Palette, 
  Shield, 
  Dice6, 
  BarChart3, 
  Calendar, 
  MessageSquare,
  Star,
  Heart,
  Clock,
  Upload,
  BookOpen,
  Trophy,
  Bell,
  Shuffle,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { getLibraryUrl } from "@/hooks/useTenantUrl";
import logoImage from "@/assets/logo.png";

interface FeatureDetailProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlights?: string[];
}

function FeatureDetail({ icon, title, description, highlights }: FeatureDetailProps) {
  return (
    <div className="bg-wood-medium/20 rounded-xl p-6 border border-border/20 hover:border-secondary/40 transition-colors">
      <div className="flex items-start gap-4">
        <div className="text-secondary shrink-0 mt-1">{icon}</div>
        <div>
          <h3 className="font-display text-xl font-semibold text-cream mb-2">{title}</h3>
          <p className="text-cream/70 mb-3">{description}</p>
          {highlights && highlights.length > 0 && (
            <ul className="space-y-1">
              {highlights.map((highlight, i) => (
                <li key={i} className="text-cream/50 text-sm flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-secondary"></span>
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Features() {
  const { isAuthenticated } = useAuth();
  const { data: myLibrary } = useMyLibrary();

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
                  <a href={getLibraryUrl(myLibrary.slug, "/")}>
                    <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                      My Library
                    </Button>
                  </a>
                )}
              </>
            ) : (
              <Link to="/login">
                <Button variant="ghost" className="text-cream/80 hover:text-cream hover:bg-wood-medium/50">
                  Sign In
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-cream/60 hover:text-cream transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        
        <h1 className="font-display text-4xl md:text-5xl font-bold text-cream mb-4">
          Everything Your Library Needs
        </h1>
        <p className="text-xl text-cream/70 max-w-2xl mb-12">
          GameTaverns is packed with features designed by board gamers, for board gamers. 
          Discover what makes our platform the best way to manage your collection.
        </p>
      </section>

      {/* Core Features */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="font-display text-2xl font-bold text-cream mb-6 flex items-center gap-3">
          <Library className="h-6 w-6 text-secondary" />
          Core Library Features
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Upload className="h-6 w-6" />}
            title="Easy Game Import"
            description="Add games to your library in seconds with automatic data from BoardGameGeek."
            highlights={[
              "Search by name or BGG URL",
              "Bulk CSV import for large collections",
              "Automatic box art, player counts, and descriptions",
              "Edit any field after import"
            ]}
          />
          
          <FeatureDetail
            icon={<BookOpen className="h-6 w-6" />}
            title="Rich Game Details"
            description="Every game in your library includes comprehensive information."
            highlights={[
              "Player count and play time",
              "Complexity ratings",
              "Your personal notes and condition",
              "Storage location tracking"
            ]}
          />
          
          <FeatureDetail
            icon={<Star className="h-6 w-6" />}
            title="Favorites & Ratings"
            description="Let visitors rate games and mark your favorites to highlight top picks."
            highlights={[
              "5-star guest rating system",
              "Favorite games highlighted in collection",
              "Average ratings displayed on cards"
            ]}
          />
          
          <FeatureDetail
            icon={<Heart className="h-6 w-6" />}
            title="Guest Wishlist"
            description="Visitors can wishlist games they'd like to play at your next game night."
            highlights={[
              "No account required for guests",
              "See what games are most requested",
              "Perfect for planning game nights"
            ]}
          />
        </div>
      </section>

      {/* Play Tracking */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="font-display text-2xl font-bold text-cream mb-6 flex items-center gap-3">
          <Dice6 className="h-6 w-6 text-secondary" />
          Play Tracking & Statistics
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Clock className="h-6 w-6" />}
            title="Play Session Logging"
            description="Record every game session with detailed information."
            highlights={[
              "Date, duration, and player count",
              "Track winners and scores",
              "Add session notes and photos",
              "Log expansions used"
            ]}
          />
          
          <FeatureDetail
            icon={<BarChart3 className="h-6 w-6" />}
            title="BG Stats-Style Analytics"
            description="Beautiful statistics inspired by the popular BG Stats app."
            highlights={[
              "H-index calculation",
              "Monthly and yearly play summaries",
              "Most played games leaderboard",
              "Player win rates and statistics"
            ]}
          />
          
          <FeatureDetail
            icon={<Trophy className="h-6 w-6" />}
            title="Achievements System"
            description="Earn badges and track milestones as you play more games."
            highlights={[
              "Play count achievements",
              "Variety and streak badges",
              "Secret achievements to discover",
              "Showcase your gaming journey"
            ]}
          />
          
          <FeatureDetail
            icon={<Shuffle className="h-6 w-6" />}
            title="Random Game Picker"
            description="Can't decide what to play? Let us choose for you!"
            highlights={[
              "Filter by player count",
              "Filter by play time",
              "Exclude recently played",
              "Spin the wheel for game night"
            ]}
          />
        </div>
      </section>

      {/* Lending & Community */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="font-display text-2xl font-bold text-cream mb-6 flex items-center gap-3">
          <Users className="h-6 w-6 text-secondary" />
          Lending Library & Community
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Users className="h-6 w-6" />}
            title="Lending Library"
            description="Run a community lending library with request management."
            highlights={[
              "Members can request to borrow games",
              "Track who has what and when it's due",
              "Borrower ratings and reviews",
              "Customizable lending terms"
            ]}
          />
          
          <FeatureDetail
            icon={<Calendar className="h-6 w-6" />}
            title="Events & Game Nights"
            description="Plan and promote your game nights directly from your library."
            highlights={[
              "Create upcoming events",
              "RSVP tracking",
              "Discord integration for notifications",
              "Event descriptions and locations"
            ]}
          />
          
          <FeatureDetail
            icon={<MessageSquare className="h-6 w-6" />}
            title="Secure Messaging"
            description="Visitors can contact you about games without exposing your email."
            highlights={[
              "Encrypted message storage",
              "Reply directly from dashboard",
              "Spam protection with Turnstile",
              "No account required to send"
            ]}
          />
          
          <FeatureDetail
            icon={<Bell className="h-6 w-6" />}
            title="Notifications"
            description="Stay informed about activity in your library."
            highlights={[
              "Email notifications",
              "Discord webhook integration",
              "Loan request alerts",
              "Event reminders"
            ]}
          />
        </div>
      </section>

      {/* Customization */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="font-display text-2xl font-bold text-cream mb-6 flex items-center gap-3">
          <Palette className="h-6 w-6 text-secondary" />
          Customization & Privacy
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FeatureDetail
            icon={<Palette className="h-6 w-6" />}
            title="Full Theme Customization"
            description="Make your library uniquely yours with complete visual control."
            highlights={[
              "Custom colors for light and dark mode",
              "Upload your own logo",
              "Custom background images",
              "Font customization"
            ]}
          />
          
          <FeatureDetail
            icon={<Shield className="h-6 w-6" />}
            title="Privacy Controls"
            description="You control what visitors can see and do."
            highlights={[
              "Toggle feature visibility",
              "Hide admin-only data (purchase prices)",
              "Public or private library mode",
              "Directory listing opt-in"
            ]}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="bg-wood-medium/30 rounded-2xl p-12 border border-border/30">
          <h2 className="font-display text-3xl font-bold text-cream mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-cream/70 mb-8 max-w-xl mx-auto">
            Create your free library today and start organizing your board game collection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              myLibrary ? (
                <a href={getLibraryUrl(myLibrary.slug, "/")}>
                  <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
                    Go to My Library
                  </Button>
                </a>
              ) : (
                <Link to="/create-library">
                  <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
                    Create Your Library
                  </Button>
                </Link>
              )
            ) : (
              <Link to="/signup">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8">
                  Start Free
                </Button>
              </Link>
            )}
            <Link to="/">
              <Button size="lg" variant="outline" className="border-cream/30 text-cream hover:bg-wood-medium/50 text-lg px-8">
                Back to Home
              </Button>
            </Link>
          </div>
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
