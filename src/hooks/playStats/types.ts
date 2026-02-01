export type StatsPeriod = "month" | "year";

export interface PlayStats {
  totalPlays: number;
  gamesPlayed: number;
  newGamesThisPeriod: number;
  uniquePlayers: number;
  totalHours: number;
  daysWithPlays: number;
  hIndex: number;
  topMechanics: { name: string; percentage: number; count: number }[];
  topGames: { id: string; title: string; image_url: string | null; plays: number }[];
  periodLabel: string;
}
