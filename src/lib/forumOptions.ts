// Shared icon and color options for forum category management

export const FORUM_ICON_OPTIONS = [
  // Communication
  { value: "MessageSquare", label: "Discussion" },
  { value: "Megaphone", label: "Announcements" },
  { value: "MessagesSquare", label: "Chat" },
  { value: "Mail", label: "Messages" },
  
  // People & Community
  { value: "Users", label: "Community" },
  { value: "UserPlus", label: "Introductions" },
  { value: "HeartHandshake", label: "Help/Support" },
  
  // Entertainment & Hobbies
  { value: "Gamepad2", label: "Video Games" },
  { value: "Dice5", label: "Board Games" },
  { value: "Tv", label: "TV/Movies" },
  { value: "Music", label: "Music" },
  { value: "BookOpen", label: "Books/Reading" },
  { value: "Palette", label: "Art/Creative" },
  { value: "Camera", label: "Photography" },
  
  // Topics
  { value: "Cpu", label: "Technology" },
  { value: "Code", label: "Programming" },
  { value: "FlaskConical", label: "Science" },
  { value: "Landmark", label: "Politics" },
  { value: "Church", label: "Religion" },
  { value: "GraduationCap", label: "Education" },
  { value: "Dumbbell", label: "Fitness/Sports" },
  { value: "UtensilsCrossed", label: "Food/Cooking" },
  { value: "Plane", label: "Travel" },
  { value: "Briefcase", label: "Career/Work" },
  
  // Commerce
  { value: "ShoppingBag", label: "Marketplace" },
  { value: "Tag", label: "Deals/Sales" },
  { value: "Repeat", label: "Trades" },
  
  // Events & Activities
  { value: "Calendar", label: "Events" },
  { value: "Trophy", label: "Tournaments" },
  { value: "PartyPopper", label: "Celebrations" },
  
  // Misc
  { value: "Sparkles", label: "Anime/Manga" },
  { value: "Lightbulb", label: "Ideas/Suggestions" },
  { value: "Bug", label: "Bug Reports" },
  { value: "HelpCircle", label: "Questions" },
  { value: "Star", label: "Featured" },
  { value: "Flame", label: "Hot Topics" },
  { value: "Archive", label: "Archives" },
] as const;

export const FORUM_COLOR_OPTIONS = [
  // Blues
  { value: "blue", label: "Blue" },
  { value: "sky", label: "Sky Blue" },
  { value: "cyan", label: "Cyan" },
  { value: "indigo", label: "Indigo" },
  
  // Greens
  { value: "green", label: "Green" },
  { value: "emerald", label: "Emerald" },
  { value: "teal", label: "Teal" },
  { value: "lime", label: "Lime" },
  
  // Warm
  { value: "amber", label: "Amber" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "rose", label: "Rose" },
  { value: "pink", label: "Pink" },
  
  // Purples
  { value: "purple", label: "Purple" },
  { value: "violet", label: "Violet" },
  { value: "fuchsia", label: "Fuchsia" },
  
  // Neutrals
  { value: "slate", label: "Slate" },
  { value: "zinc", label: "Zinc" },
  { value: "stone", label: "Stone" },
] as const;

export type ForumIconValue = (typeof FORUM_ICON_OPTIONS)[number]["value"];
export type ForumColorValue = (typeof FORUM_COLOR_OPTIONS)[number]["value"];
