import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, Library, Users, Palette, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";

export default function Platform() {
  const { isAuthenticated, user } = useAuth();
  const { data: myLibrary, isLoading: libraryLoading } = useMyLibrary();
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (myLibrary) {
        // Go to their library
        navigate(`/?tenant=${myLibrary.slug}`);
      } else {
        // Go to create library
        navigate("/create-library");
      }
    } else {
      navigate("/login");
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900">
      {/* Header */}
      <header className="border-b border-amber-700/50 bg-amber-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-amber-400" />
            <span className="font-display text-2xl font-bold text-amber-100">
              GameTaverns
            </span>
          </Link>
          
          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" className="text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
                    Dashboard
                  </Button>
                </Link>
                {myLibrary && (
                  <Link to={`/?tenant=${myLibrary.slug}`}>
                    <Button className="bg-amber-500 text-amber-950 hover:bg-amber-400">
                      My Library
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-amber-200 hover:text-amber-100 hover:bg-amber-800/50">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-amber-500 text-amber-950 hover:bg-amber-400">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-5xl md:text-7xl font-bold text-amber-100 mb-6">
          Your Board Game Collection,
          <br />
          <span className="text-amber-400">Beautifully Organized</span>
        </h1>
        <p className="text-xl text-amber-200/80 max-w-2xl mx-auto mb-10">
          Create your own personalized board game library. Track your collection, 
          log play sessions, share with friends, and make it uniquely yours.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-amber-500 text-amber-950 hover:bg-amber-400 text-lg px-8 py-6"
            onClick={handleGetStarted}
          >
            {isAuthenticated ? (myLibrary ? "Go to My Library" : "Create Your Library") : "Start Free"}
          </Button>
          <Link to="/docs">
            <Button 
              size="lg" 
              variant="outline" 
              className="border-amber-500/50 text-amber-200 hover:bg-amber-800/50 text-lg px-8 py-6"
            >
              Learn More
            </Button>
          </Link>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16">
          <div>
            <div className="text-3xl font-bold text-amber-400">500+</div>
            <div className="text-amber-200/60 text-sm">Libraries Created</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-amber-400">10k+</div>
            <div className="text-amber-200/60 text-sm">Games Cataloged</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-amber-400">25k+</div>
            <div className="text-amber-200/60 text-sm">Plays Logged</div>
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="font-display text-3xl font-bold text-amber-100 text-center mb-12">
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
            icon={<Gamepad2 className="h-8 w-8" />}
            title="BGG Import"
            description="Import your collection from BoardGameGeek with one click. Get box art and descriptions automatically."
          />
        </div>
      </section>
      
      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="bg-amber-800/30 rounded-2xl p-12 border border-amber-700/50">
          <h2 className="font-display text-3xl font-bold text-amber-100 mb-4">
            Ready to Create Your Library?
          </h2>
          <p className="text-amber-200/80 mb-8 max-w-xl mx-auto">
            Join thousands of board game enthusiasts who trust GameTaverns to organize and showcase their collections.
          </p>
          <Button 
            size="lg" 
            className="bg-amber-500 text-amber-950 hover:bg-amber-400 text-lg px-8"
            onClick={handleGetStarted}
          >
            Get Started Free
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-amber-700/50 bg-amber-950/50 py-8">
        <div className="container mx-auto px-4 text-center text-amber-200/60">
          <p>&copy; 2026 GameTaverns. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-amber-800/20 rounded-xl p-6 border border-amber-700/30 hover:border-amber-600/50 transition-colors">
      <div className="text-amber-400 mb-4">{icon}</div>
      <h3 className="font-display text-xl font-semibold text-amber-100 mb-2">{title}</h3>
      <p className="text-amber-200/70">{description}</p>
    </div>
  );
}
