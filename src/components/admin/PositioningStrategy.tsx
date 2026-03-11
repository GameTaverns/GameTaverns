import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Users, Building2, Store, Gamepad2, ArrowRight, CheckCircle2, MinusCircle } from "lucide-react";

const AUDIENCES = [
  {
    priority: 1,
    label: "Convention & Event Organizers",
    description: "Organizations like LoveThyNerd who run lending libraries at conventions.",
    needs: [
      "Real-time checkout/return tracking across multiple lending libraries",
      "Staff-managed lending desks with barcode scanning",
      "Guest walk-up support (no account required for borrowers)",
      "Inventory visibility across the event",
      "Condition tracking and damage reporting",
    ],
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    priority: 2,
    label: "Board Game Clubs & Groups",
    description: "Local groups, meetup organizers, game café regulars.",
    needs: [
      "A shared space for their group (not Discord/Facebook)",
      "Event scheduling and coordination",
      "Shared game catalog across members",
      "Lending between members with tracking",
      "Forums and social interaction",
    ],
    icon: <Users className="h-5 w-5" />,
  },
  {
    priority: 3,
    label: "Board Game Cafés (B2B)",
    description: "Cafés and retail spaces with play-and-borrow libraries.",
    needs: [
      "Inventory management for lending collection",
      "Customer-facing catalog (embed widget, kiosk mode)",
      "Play tracking and popular game analytics",
      "Event promotion and community building",
    ],
    icon: <Store className="h-5 w-5" />,
  },
  {
    priority: 4,
    label: "Enthusiast Collectors (Secondary)",
    description: "Individual collectors who want more than BGG — but NOT the lead message anymore.",
    needs: [
      "Collection intelligence (value tracking, DNA analysis)",
      "Play logging and stats",
      "Social features (follows, activity feed)",
    ],
    icon: <Gamepad2 className="h-5 w-5" />,
  },
];

const TAGLINE_OPTIONS = [
  "Where game nights come together",
  "Run your club. Track your plays. Build your crew.",
  "The tabletop community platform",
  "Your board game club, organized",
  "From game night to GenCon — one platform",
  "Board game clubs, conventions, and communities",
];

const LANDING_SECTIONS = [
  { title: "Hero", desc: "Clubs/conventions/organized play headline. CTA: 'Start a Club' / 'Plan an Event'" },
  { title: "Clubs & Communities", desc: "Create or join a club, shared catalog, forums, messaging" },
  { title: "Convention & Event Tools", desc: "Lending desk, real-time checkout, barcode scanning, LoveThyNerd story" },
  { title: "Events & Game Nights", desc: "Calendar, registration, location-based discovery" },
  { title: "Play Tracking & Social", desc: "Log plays, activity feed, achievements, play-by-forum" },
  { title: "Oh, and Your Collection Too", desc: "Collection tools as bonus, not headline. BGG import path." },
  { title: "For Cafés & Organizations", desc: "Embed widgets, kiosk mode, analytics, B2B teaser" },
];

const COMPETITIVE = [
  { name: "BGG", focus: "Database + forums", advantage: "We do organized play, they don't" },
  { name: "Aftergame", focus: "Play tracking social", advantage: "We do clubs + conventions + lending" },
  { name: "BG Stats", focus: "Personal play logging", advantage: "We're multiplayer-first, group-oriented" },
  { name: "Discord/Facebook", focus: "General community", advantage: "We're purpose-built for tabletop" },
  { name: "No one", focus: "Convention lending", advantage: "Greenfield — this is ours" },
];

const EMPHASIZE = [
  "Club lending polish (mostly built)",
  "Convention lending desk enhancements",
  "Event discovery and coordination",
  "Club onboarding flow",
  "Convention Game Concierge (reservation/spinner)",
];

const DE_EMPHASIZE = [
  "Collection-first messaging",
  "\"BGG alternative\" positioning",
  "Individual catalog features in marketing",
];

export function PositioningStrategy() {
  return (
    <div className="space-y-8">
      {/* The Shift */}
      <Card className="bg-wood-medium/20 border-secondary/30">
        <CardHeader>
          <CardTitle className="text-cream flex items-center gap-2">
            <Target className="h-5 w-5 text-secondary" />
            The Positioning Pivot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-xs font-bold text-destructive/80 uppercase mb-1">From</p>
              <p className="text-cream font-display text-lg">"A board game collection manager"</p>
              <p className="text-cream/60 text-sm mt-1">Competing with BGG — unwinnable</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-xs font-bold text-emerald-400 uppercase mb-1">To</p>
              <p className="text-cream font-display text-lg">"The club & convention platform for tabletop gaming"</p>
              <p className="text-cream/60 text-sm mt-1">Competing with nobody</p>
            </div>
          </div>
          <p className="text-cream/70 text-sm">
            Collection management still exists — it's the engine underneath — but it's not what we lead with.
            Nobody wakes up thinking "I need a better spreadsheet for my games." They think
            "I need to organize game night" or "I need to track 200 checkouts at GenCon."
          </p>
        </CardContent>
      </Card>

      {/* Target Audiences */}
      <Card className="bg-wood-medium/20 border-wood-medium/50">
        <CardHeader>
          <CardTitle className="text-cream">Who We Serve (Priority Order)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {AUDIENCES.map((audience) => (
            <div key={audience.priority} className="rounded-lg border border-wood-medium/40 bg-wood-dark/30 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="text-secondary border-secondary/40 text-xs">
                  #{audience.priority}
                </Badge>
                <span className="text-secondary">{audience.icon}</span>
                <h3 className="text-cream font-display font-bold">{audience.label}</h3>
              </div>
              <p className="text-cream/60 text-sm mb-2">{audience.description}</p>
              <ul className="space-y-1">
                {audience.needs.map((need, i) => (
                  <li key={i} className="text-cream/70 text-sm flex items-start gap-2">
                    <ArrowRight className="h-3 w-3 mt-1 text-secondary/60 shrink-0" />
                    {need}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tagline Candidates */}
      <Card className="bg-wood-medium/20 border-wood-medium/50">
        <CardHeader>
          <CardTitle className="text-cream">Tagline Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {TAGLINE_OPTIONS.map((tagline) => (
              <div key={tagline} className="rounded-lg border border-wood-medium/30 bg-wood-dark/20 p-3">
                <p className="text-cream font-display text-sm italic">"{tagline}"</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Landing Page Story Arc */}
      <Card className="bg-wood-medium/20 border-wood-medium/50">
        <CardHeader>
          <CardTitle className="text-cream">Landing Page Story Arc (Proposed)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {LANDING_SECTIONS.map((section, i) => (
              <div key={section.title} className="flex items-start gap-3 rounded-lg border border-wood-medium/30 bg-wood-dark/20 p-3">
                <Badge variant="outline" className="text-secondary border-secondary/40 text-xs shrink-0 mt-0.5">
                  {i + 1}
                </Badge>
                <div>
                  <h4 className="text-cream font-bold text-sm">{section.title}</h4>
                  <p className="text-cream/60 text-xs">{section.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competitive Landscape */}
      <Card className="bg-wood-medium/20 border-wood-medium/50">
        <CardHeader>
          <CardTitle className="text-cream">Competitive Landscape</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wood-medium/40">
                  <th className="text-cream/80 text-left py-2 pr-4 font-medium">Platform</th>
                  <th className="text-cream/80 text-left py-2 pr-4 font-medium">Focus</th>
                  <th className="text-cream/80 text-left py-2 font-medium">Our Advantage</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITIVE.map((row) => (
                  <tr key={row.name} className="border-b border-wood-medium/20">
                    <td className="text-cream py-2 pr-4 font-bold">{row.name}</td>
                    <td className="text-cream/60 py-2 pr-4">{row.focus}</td>
                    <td className="text-cream/80 py-2">
                      {row.name === "No one" ? (
                        <span className="text-emerald-400 font-bold">{row.advantage}</span>
                      ) : row.advantage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Prioritization */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-wood-medium/20 border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-cream text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Emphasize
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {EMPHASIZE.map((item) => (
                <li key={item} className="text-cream/70 text-sm flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 mt-1 text-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="bg-wood-medium/20 border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-cream text-base flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-destructive/80" />
              De-emphasize
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {DE_EMPHASIZE.map((item) => (
                <li key={item} className="text-cream/70 text-sm flex items-start gap-2">
                  <MinusCircle className="h-3 w-3 mt-1 text-destructive/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
