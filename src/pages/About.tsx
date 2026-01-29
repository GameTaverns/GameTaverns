import { Link } from "react-router-dom";
import { Heart, Users, Globe, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";

export default function About() {
  return (
    <div className="min-h-screen parchment-texture">
      <div className="container max-w-4xl py-16 px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <img src={logo} alt="GameTaverns" className="h-20 mx-auto mb-6" />
          <h1 className="text-4xl font-display font-bold mb-4">About GameTaverns</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A passion project built by board game enthusiasts, for board game enthusiasts.
          </p>
        </div>

        {/* Story Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-2">Our Story</h2>
          <div className="prose prose-stone dark:prose-invert max-w-none">
            <p>
              GameTaverns started as a simple idea: what if there was an easy way for board 
              game collectors to share their libraries with friends and gaming groups?
            </p>
            <p>
              As our own collections grew, we found ourselves constantly fielding questions: 
              "What games do you have?", "Can we play that one I saw last time?", 
              "Do you have anything good for 6 players?" We wanted a beautiful, 
              searchable catalog that we could share with anyone—without needing to send 
              spreadsheets or maintain complex databases.
            </p>
            <p>
              So we built GameTaverns. What started as a personal project evolved into a 
              platform that any collector can use to showcase their games, organize game 
              nights, and connect with their community.
            </p>
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-2">What We Believe</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <Heart className="h-10 w-10 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Passion Over Profit</h3>
                <p className="text-sm text-muted-foreground">
                  GameTaverns is a hobby project, not a startup. We build features we 
                  genuinely want to use, not to maximize engagement metrics.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-10 w-10 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Community First</h3>
                <p className="text-sm text-muted-foreground">
                  Board gaming is about bringing people together. Every feature we build 
                  aims to foster connection and make organizing easier.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Globe className="h-10 w-10 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Privacy Respecting</h3>
                <p className="text-sm text-muted-foreground">
                  No ads, no tracking, no selling your data. Your library is yours, 
                  and your visitors' privacy is protected.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-2">What You Can Do</h2>
          <div className="prose prose-stone dark:prose-invert max-w-none">
            <ul>
              <li>
                <strong>Catalog Your Collection:</strong> Import games from BoardGameGeek 
                or add them manually. Track details like condition, sleeves, and storage location.
              </li>
              <li>
                <strong>Share with Anyone:</strong> Get a beautiful, mobile-friendly link 
                to share with friends, gaming groups, or the world.
              </li>
              <li>
                <strong>Organize Game Nights:</strong> Create polls to vote on which games 
                to play, and let friends RSVP to events.
              </li>
              <li>
                <strong>Track Plays:</strong> Log your gaming sessions, record winners, 
                and see statistics about your most-played games.
              </li>
              <li>
                <strong>Wishlist Voting:</strong> Let friends vote on which games you 
                should add to your collection next.
              </li>
              <li>
                <strong>Customize Your Library:</strong> Personalize colors, fonts, and 
                branding to make your library uniquely yours.
              </li>
            </ul>
          </div>
        </section>

        {/* Open Source Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-2">Open & Transparent</h2>
          <div className="prose prose-stone dark:prose-invert max-w-none">
            <p>
              GameTaverns can be self-hosted by technically-inclined users who want full 
              control over their data. We provide Docker-based deployment configurations 
              and documentation to get you up and running on your own server.
            </p>
            <p>
              We believe in transparency about how the platform works and welcome feedback 
              from our community.
            </p>
          </div>
          <div className="mt-6">
            <Button variant="outline" asChild>
              <a 
                href="https://github.com/YOUR_USERNAME/GameTavern" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </section>

        {/* Contact Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-2">Get in Touch</h2>
          <div className="prose prose-stone dark:prose-invert max-w-none">
            <p>
              We love hearing from fellow board game enthusiasts! Whether you have a 
              feature suggestion, found a bug, or just want to share your favorite game, 
              we'd love to hear from you.
            </p>
            <p>
              Contact us at: <a href="mailto:admin@gametaverns.com" className="text-primary hover:underline">admin@gametaverns.com</a>
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center bg-card rounded-lg p-8 border">
          <h2 className="text-2xl font-display font-semibold mb-4">Ready to Start Your Library?</h2>
          <p className="text-muted-foreground mb-6">
            Join thousands of collectors sharing their board game passion.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/signup">Create Your Library</Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link to="/">Explore Platform</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
