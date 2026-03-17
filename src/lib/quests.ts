/**
 * Quest System
 * 
 * Multi-step guided quests that walk users through platform features.
 * Progress is computed from the same metrics used by achievements.
 */

import type { AchievementProgress } from "@/hooks/useAchievements";

export interface QuestStep {
  id: string;
  label: string;
  description: string;
  requirementType: keyof AchievementProgress;
  requirementValue: number;
  icon: string;
}

export interface Quest {
  slug: string;
  name: string;
  description: string;
  icon: string;
  bonusPoints: number;
  steps: QuestStep[];
  color: string; // Tailwind text color class
}

export const QUESTS: Quest[] = [
  {
    slug: "curators-path",
    name: "Curator's Path",
    description: "Build your collection, share your opinions, and curate your taste.",
    icon: "📚",
    bonusPoints: 50,
    color: "text-blue-500",
    steps: [
      {
        id: "cp-1",
        label: "Start a collection",
        description: "Add 5 games to your library",
        requirementType: "games_owned",
        requirementValue: 5,
        icon: "📦",
      },
      {
        id: "cp-2",
        label: "Share your opinion",
        description: "Rate 3 games in your library",
        requirementType: "ratings_given",
        requirementValue: 3,
        icon: "⭐",
      },
      {
        id: "cp-3",
        label: "Diversify",
        description: "Own games from 3 different types",
        requirementType: "unique_game_types",
        requirementValue: 3,
        icon: "🎯",
      },
    ],
  },
  {
    slug: "social-butterfly",
    name: "Social Butterfly",
    description: "Connect with other collectors and grow your network.",
    icon: "🦋",
    bonusPoints: 50,
    color: "text-purple-500",
    steps: [
      {
        id: "sb-1",
        label: "Get noticed",
        description: "Gain your first follower or library member",
        requirementType: "followers_gained",
        requirementValue: 1,
        icon: "👋",
      },
      {
        id: "sb-2",
        label: "Show it off",
        description: "Upload a photo to your gallery",
        requirementType: "photos_uploaded",
        requirementValue: 1,
        icon: "📸",
      },
      {
        id: "sb-3",
        label: "Build a community",
        description: "Gain 5 followers or library members",
        requirementType: "followers_gained",
        requirementValue: 5,
        icon: "🤝",
      },
    ],
  },
  {
    slug: "lending-legend",
    name: "Lending Legend",
    description: "Share the joy of gaming by lending your collection.",
    icon: "🤲",
    bonusPoints: 75,
    color: "text-teal-500",
    steps: [
      {
        id: "ll-1",
        label: "First loan",
        description: "Complete your first game loan",
        requirementType: "loans_completed",
        requirementValue: 1,
        icon: "📖",
      },
      {
        id: "ll-2",
        label: "Generous spirit",
        description: "Complete 5 game loans",
        requirementType: "loans_completed",
        requirementValue: 5,
        icon: "🎁",
      },
      {
        id: "ll-3",
        label: "Lending master",
        description: "Complete 10 game loans",
        requirementType: "loans_completed",
        requirementValue: 10,
        icon: "🏅",
      },
    ],
  },
  {
    slug: "play-chronicler",
    name: "Play Chronicler",
    description: "Record your gaming history and become a seasoned player.",
    icon: "📖",
    bonusPoints: 50,
    color: "text-orange-500",
    steps: [
      {
        id: "pc-1",
        label: "First session",
        description: "Log your first play session",
        requirementType: "sessions_logged",
        requirementValue: 1,
        icon: "🎮",
      },
      {
        id: "pc-2",
        label: "Getting into it",
        description: "Log 10 play sessions",
        requirementType: "sessions_logged",
        requirementValue: 10,
        icon: "📝",
      },
      {
        id: "pc-3",
        label: "Dedicated player",
        description: "Log 25 play sessions",
        requirementType: "sessions_logged",
        requirementValue: 25,
        icon: "🏆",
      },
    ],
  },
];

/**
 * Calculate quest step completion from progress data
 */
export function getQuestProgress(quest: Quest, progress: AchievementProgress): {
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  stepStatuses: { step: QuestStep; completed: boolean; current: number }[];
} {
  const stepStatuses = quest.steps.map((step) => {
    const current = progress[step.requirementType] || 0;
    return {
      step,
      completed: current >= step.requirementValue,
      current,
    };
  });

  const completedSteps = stepStatuses.filter((s) => s.completed).length;

  return {
    completedSteps,
    totalSteps: quest.steps.length,
    isComplete: completedSteps === quest.steps.length,
    stepStatuses,
  };
}
