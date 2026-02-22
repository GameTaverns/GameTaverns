/**
 * Import format parsers for various board game platforms.
 * Handles BGStats JSON exports, BGA CSV exports, and generic formats.
 */

// ── BGStats JSON Export Format ──────────────────────────────────────────────

export interface BGStatsGame {
  id: number;
  uuid: string;
  name: string;
  bggId?: number;
  bggName?: string;
  bggYear?: number;
  noPoints?: boolean;
  highestWins?: boolean;
  cooperative?: boolean;
  urlThumb?: string;
  designers?: string;
  usesTeams?: boolean;
  modificationDate?: string;
}

export interface BGStatsPlayerScore {
  playerRefId: number;
  score?: string;
  winner?: boolean;
  startPlayer?: boolean;
  seatOrder?: number;
  rank?: number;
  newPlayer?: boolean;
  role?: string;
  color?: string;
}

export interface BGStatsPlay {
  uuid: string;
  gameRefId: number;
  playDate: string;
  durationMin?: number;
  locationRefId?: number;
  rounds?: number;
  ignored?: boolean;
  rating?: number;
  playerScores?: BGStatsPlayerScore[];
  usesTeams?: boolean;
  comments?: string;
  entryDate?: string;
  modificationDate?: string;
  bggId?: number;
  scoringSetting?: number;
  manualWinner?: boolean;
}

export interface BGStatsPlayer {
  id: number;
  uuid: string;
  name: string;
  isAnonymous?: boolean;
  bggUsername?: string;
  modificationDate?: string;
}

export interface BGStatsLocation {
  id: number;
  uuid: string;
  name: string;
  modificationDate?: string;
}

export interface BGStatsExport {
  games: BGStatsGame[];
  plays: BGStatsPlay[];
  players: BGStatsPlayer[];
  locations: BGStatsLocation[];
  userInfo?: { meRefId?: number };
  challenges?: unknown[];
}

export type DetectedFormat = "bgstats" | "bga_csv" | "generic_json" | "csv" | "unknown";

/**
 * Detect the format of an uploaded file based on content.
 */
export function detectFileFormat(content: string, filename: string): DetectedFormat {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "json" || ext === "bgsplay") {
    try {
      const data = JSON.parse(content);
      if (isBGStatsExport(data)) return "bgstats";
      return "generic_json";
    } catch {
      return "unknown";
    }
  }

  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    if (isBGAExportCSV(content)) return "bga_csv";
    return "csv";
  }

  // Try to detect from content
  try {
    const data = JSON.parse(content);
    if (isBGStatsExport(data)) return "bgstats";
    return "generic_json";
  } catch {
    // Not JSON — check if CSV
    if (content.includes(",") || content.includes("\t")) {
      if (isBGAExportCSV(content)) return "bga_csv";
      return "csv";
    }
  }

  return "unknown";
}

/**
 * Check if parsed JSON matches BGStats export structure.
 */
function isBGStatsExport(data: any): data is BGStatsExport {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.games) &&
    Array.isArray(data.plays) &&
    Array.isArray(data.players)
  );
}

/**
 * Check if CSV content matches BGA export format (from bga-export-stats bookmarklet).
 * Expected columns: Player Name, Game Name, ELO, Rank, Matches, Wins
 */
function isBGAExportCSV(content: string): boolean {
  const firstLine = content.split("\n")[0]?.toLowerCase() || "";
  return (
    firstLine.includes("player name") &&
    firstLine.includes("game name") &&
    (firstLine.includes("elo") || firstLine.includes("matches"))
  );
}

/**
 * Parse BGStats JSON export and convert games to CSV-compatible rows for game-import.
 */
export function parseBGStatsGames(data: BGStatsExport): string {
  if (!data.games || data.games.length === 0) return "";

  // Build CSV with headers matching our game-import expectations
  const headers = ["title", "bgg_id", "image_url", "is_expansion"];
  const rows = data.games.map((game) => {
    const title = escapeCsvField(game.name || game.bggName || "");
    const bggId = game.bggId ? String(game.bggId) : "";
    const imageUrl = game.urlThumb || "";
    const isExpansion = "false"; // BGStats doesn't flag expansions explicitly
    return [title, bggId, imageUrl, isExpansion].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Parse BGStats plays into a format suitable for the play-import endpoint.
 */
export function parseBGStatsPlays(data: BGStatsExport): ParsedPlay[] {
  if (!data.plays || data.plays.length === 0) return [];

  // Build lookup maps
  const gamesById = new Map<number, BGStatsGame>();
  for (const game of data.games) {
    gamesById.set(game.id, game);
  }

  const playersById = new Map<number, BGStatsPlayer>();
  for (const player of data.players) {
    playersById.set(player.id, player);
  }

  const locationsById = new Map<number, BGStatsLocation>();
  for (const loc of data.locations || []) {
    locationsById.set(loc.id, loc);
  }

  const plays: ParsedPlay[] = [];

  for (const play of data.plays) {
    if (play.ignored) continue;

    const game = gamesById.get(play.gameRefId);
    if (!game) continue;

    const location = play.locationRefId
      ? locationsById.get(play.locationRefId)
      : undefined;

    const players: ParsedPlayPlayer[] = (play.playerScores || []).map((ps) => {
      const player = playersById.get(ps.playerRefId);
      return {
        name: player?.name || "Unknown",
        score: ps.score ? parseInt(ps.score, 10) : null,
        is_winner: ps.winner || false,
        is_first_play: ps.newPlayer || false,
        color: ps.color || null,
        bgg_username: player?.bggUsername || null,
      };
    });

    plays.push({
      game_bgg_id: game.bggId ? String(game.bggId) : null,
      game_title: game.name || game.bggName || "",
      played_at: play.playDate,
      duration_minutes: play.durationMin || null,
      location: location?.name || null,
      notes: play.comments || null,
      source_id: play.uuid, // Use UUID for deduplication
      players,
    });
  }

  return plays;
}

/**
 * Parse BGA CSV export (from bga-export-stats bookmarklet) into game rows.
 * This format has: Player Name, Game Name, ELO, Rank, Matches, Wins
 * We extract unique games from it.
 */
export function parseBGAExportCSV(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return "";

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const gameNameIdx = headers.findIndex(
    (h) => h === "game name" || h === "game_name" || h === "gamename"
  );
  const matchesIdx = headers.findIndex((h) => h === "matches" || h === "total matches");

  if (gameNameIdx === -1) return content; // Can't parse, return as-is

  // Extract unique game names
  const uniqueGames = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const gameName = cols[gameNameIdx];
    if (!gameName || gameName === "Player stats" || gameName === "Recent game history") continue;

    const matches = matchesIdx >= 0 ? parseInt(cols[matchesIdx] || "0", 10) : 0;
    const existing = uniqueGames.get(gameName) || 0;
    uniqueGames.set(gameName, Math.max(existing, matches));
  }

  // Convert to CSV format for our game-import
  const outputHeaders = "title";
  const outputRows = Array.from(uniqueGames.keys()).map((name) => escapeCsvField(name));
  return [outputHeaders, ...outputRows].join("\n");
}

// ── Shared Types ────────────────────────────────────────────────────────────

export interface ParsedPlayPlayer {
  name: string;
  score: number | null;
  is_winner: boolean;
  is_first_play: boolean;
  color: string | null;
  bgg_username: string | null;
}

export interface ParsedPlay {
  game_bgg_id: string | null;
  game_title: string;
  played_at: string;
  duration_minutes: number | null;
  location: string | null;
  notes: string | null;
  source_id: string;
  players: ParsedPlayPlayer[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Get a human-readable label for a detected format.
 */
export function getFormatLabel(format: DetectedFormat): string {
  switch (format) {
    case "bgstats":
      return "BGStats Export";
    case "bga_csv":
      return "Board Game Arena Export";
    case "generic_json":
      return "JSON File";
    case "csv":
      return "CSV File";
    default:
      return "Unknown Format";
  }
}
