import { Router, Request, Response } from 'express';
import { pool } from '../services/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// Difficulty levels from the database enum
const DIFFICULTY_LEVELS = [
  "1 - Light",
  "2 - Medium Light",
  "3 - Medium",
  "4 - Medium Heavy",
  "5 - Heavy",
];

// Play time options from database enum
const PLAY_TIME_OPTIONS = [
  "0-15 Minutes",
  "15-30 Minutes",
  "30-45 Minutes",
  "45-60 Minutes",
  "60+ Minutes",
  "2+ Hours",
  "3+ Hours",
];

// Game type options from database enum
const GAME_TYPE_OPTIONS = [
  "Board Game",
  "Card Game",
  "Dice Game",
  "Party Game",
  "War Game",
  "Miniatures",
  "RPG",
  "Other",
];

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

interface BulkImportRequest {
  mode: ImportMode;
  library_id?: string;
  csv_data?: string;
  bgg_username?: string;
  bgg_links?: string[];
  enhance_with_bgg?: boolean;
  default_options?: {
    is_coming_soon?: boolean;
    is_for_sale?: boolean;
    sale_price?: number;
    sale_condition?: string;
    location_room?: string;
    location_shelf?: string;
    location_misc?: string;
    sleeved?: boolean;
    upgraded_components?: boolean;
    crowdfunded?: boolean;
    inserts?: boolean;
  };
}

interface GameToImport {
  title: string;
  bgg_id?: string;
  bgg_url?: string;
  type?: string;
  difficulty?: string;
  play_time?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  publisher?: string;
  mechanics?: string[];
  is_expansion?: boolean;
  parent_game?: string;
  is_coming_soon?: boolean;
  is_for_sale?: boolean;
  sale_price?: number;
  sale_condition?: string;
  location_room?: string;
  location_shelf?: string;
  location_misc?: string;
  sleeved?: boolean;
  upgraded_components?: boolean;
  crowdfunded?: boolean;
  inserts?: boolean;
  in_base_game_box?: boolean;
  description?: string;
  image_url?: string;
  purchase_date?: string;
  purchase_price?: number;

  /**
   * Internal import-only fields (not persisted directly).
   * Used to decide whether to enrich from BGG when CSV has only notes.
   */
  _csv_description?: string;
  _csv_notes?: string;
}

// Parse CSV data - handles multi-line quoted fields properly
function parseCSV(csvData: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  
  for (let i = 0; i < csvData.length; i++) {
    const char = csvData[i];
    const nextChar = csvData[i + 1];
    
    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else if (char === '\r' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== "")) {
      rows.push(currentRow);
    }
  }
  
  if (rows.length < 2) return [];
  
  // Normalize headers: lowercase, trim, replace spaces with underscores
  // This ensures compatibility with both exported CSVs ("Play Time") and BGG exports ("playingtime")
  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
  
  const result: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    result.push(row);
  }
  
  return result;
}

// Helper functions
const parseBool = (val: string | undefined): boolean => {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return v === "true" || v === "yes" || v === "1";
};

const parseNum = (val: string | undefined): number | undefined => {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
};

const parsePrice = (val: string | undefined): number | undefined => {
  if (!val) return undefined;
  const cleaned = val.replace(/[^0-9.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
};

const parseDate = (val: string | undefined): string | undefined => {
  if (!val) return undefined;
  const dateMatch = val.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateMatch) return val;
  const date = new Date(val);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return undefined;
};

const mapWeightToDifficulty = (weight: string | undefined): string | undefined => {
  if (!weight) return undefined;
  const w = parseFloat(weight);
  if (isNaN(w) || w === 0) return undefined;
  if (w < 1.5) return "1 - Light";
  if (w < 2.25) return "2 - Medium Light";
  if (w < 3.0) return "3 - Medium";
  if (w < 3.75) return "4 - Medium Heavy";
  return "5 - Heavy";
};

const mapPlayTimeToEnum = (minutes: number | undefined): string | undefined => {
  if (!minutes) return undefined;
  if (minutes <= 15) return "0-15 Minutes";
  if (minutes <= 30) return "15-30 Minutes";
  if (minutes <= 45) return "30-45 Minutes";
  if (minutes <= 60) return "45-60 Minutes";
  if (minutes <= 120) return "60+ Minutes";
  if (minutes <= 180) return "2+ Hours";
  return "3+ Hours";
};

const buildNotes = (
  privateComment: string | undefined,
  comment: string | undefined,
): string | undefined => {
  const notes = [comment, privateComment]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  return notes.length ? notes.join("\n\n") : undefined;
};

const buildDescriptionWithNotes = (
  description: string | undefined,
  notes: string | undefined,
): string | undefined => {
  const desc = description?.trim();
  const n = notes?.trim();
  if (!desc && !n) return undefined;
  if (!n) return desc;
  if (!desc) return `**Notes:** ${n}`;
  return `${desc}\n\n**Notes:** ${n}`;
};

const isEmpty = (val: unknown): boolean => {
  if (val === undefined || val === null) return true;
  if (typeof val !== 'string') return false;
  const v = val.trim();
  return v === "" || v.toLowerCase() === "null";
};

// Helper: sleep for ms
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch game data from BGG XML API (with retry for 202 responses)
async function fetchBGGXMLData(bggId: string): Promise<{
  bgg_id: string;
  title?: string;
  description?: string;
  image_url?: string;
  min_players?: number;
  max_players?: number;
  suggested_age?: string;
  play_time?: string;
  difficulty?: string;
  mechanics?: string[];
  publisher?: string;
} | null> {
  const xmlUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(xmlUrl, {
        headers: { "User-Agent": "GameTaverns/1.0 (Bulk Import)" },
      });

      // BGG often returns 202 while preparing the response; retry with backoff.
      if (res.status === 202 && attempt < maxAttempts) {
        const backoffMs = Math.min(750 * attempt, 4000);
        console.log(`[BulkImport] BGG XML not ready for ${bggId}, retrying (${attempt}/${maxAttempts}) in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      if (!res.ok) {
        console.warn(`[BulkImport] BGG XML API returned ${res.status} for ${bggId}`);
        return { bgg_id: bggId };
      }

      const xml = await res.text();

      // Some proxies/cache layers return a 200 with a "retry later" message body.
      const retryable =
        xml.includes("Please try again later") ||
        xml.includes("Your request has been accepted") ||
        xml.includes("<message>") ||
        !xml.includes("<item");

      if (retryable && attempt < maxAttempts) {
        const backoffMs = Math.min(750 * attempt, 4000);
        console.log(`[BulkImport] BGG XML not ready for ${bggId}, retrying (${attempt}/${maxAttempts}) in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      // Extract primary name
      const nameMatch = xml.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);

      // Extract data using regex (simple parsing for XML)
      const imageMatch = xml.match(/<image>([^<]+)<\/image>/);
      // Description can contain HTML entities like &lt; so we need to match everything until closing tag
      const descMatch = xml.match(/<description>([\s\S]*?)<\/description>/);
      const minPlayersMatch = xml.match(/<minplayers[^>]*value="(\d+)"/);
      const maxPlayersMatch = xml.match(/<maxplayers[^>]*value="(\d+)"/);
      const minAgeMatch = xml.match(/<minage[^>]*value="(\d+)"/);
      const playTimeMatch = xml.match(/<playingtime[^>]*value="(\d+)"/);
      const weightMatch = xml.match(/<averageweight[^>]*value="([\d.]+)"/);

      // Extract mechanics
      const mechanicsMatches = xml.matchAll(/<link[^>]*type="boardgamemechanic"[^>]*value="([^"]+)"/g);
      const mechanics = [...mechanicsMatches].map((m) => m[1]);

      // Extract publisher (first one)
      const publisherMatch = xml.match(/<link[^>]*type="boardgamepublisher"[^>]*value="([^"]+)"/);

      // Map weight to difficulty
      let difficulty: string | undefined;
      if (weightMatch) {
        const w = parseFloat(weightMatch[1]);
        if (w > 0) {
          if (w < 1.5) difficulty = "1 - Light";
          else if (w < 2.25) difficulty = "2 - Medium Light";
          else if (w < 3.0) difficulty = "3 - Medium";
          else if (w < 3.75) difficulty = "4 - Medium Heavy";
          else difficulty = "5 - Heavy";
        }
      }

      // Map play time to enum
      let play_time: string | undefined;
      if (playTimeMatch) {
        const minutes = parseInt(playTimeMatch[1], 10);
        play_time = mapPlayTimeToEnum(minutes);
      }

      // Decode HTML entities in description
      let description = descMatch?.[1];
      if (description) {
        description = description
          .replace(/&#10;/g, "\n")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .slice(0, 2000); // Limit length
      }

      console.log(`[BulkImport] BGG XML fetched data for ${bggId}: ${nameMatch?.[1] || "unknown title"}`);

      return {
        bgg_id: bggId,
        title: nameMatch?.[1],
        image_url: imageMatch?.[1],
        description,
        min_players: minPlayersMatch ? parseInt(minPlayersMatch[1], 10) : undefined,
        max_players: maxPlayersMatch ? parseInt(maxPlayersMatch[1], 10) : undefined,
        suggested_age: minAgeMatch ? `${minAgeMatch[1]}+` : undefined,
        play_time,
        difficulty,
        mechanics: mechanics.length > 0 ? mechanics : undefined,
        publisher: publisherMatch?.[1],
      };
    } catch (e) {
      console.error("[BulkImport] BGG XML fetch error:", e);
      if (attempt < maxAttempts) {
        const backoffMs = Math.min(750 * attempt, 4000);
        await sleep(backoffMs);
        continue;
      }
      return { bgg_id: bggId };
    }
  }

  return { bgg_id: bggId };
}

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

// Bulk import endpoint
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body: BulkImportRequest = req.body;
    const { mode, library_id, csv_data, bgg_username, bgg_links, enhance_with_bgg, default_options } = body;

    // Get user's library
    const libraryResult = await pool.query(
      'SELECT id FROM libraries WHERE owner_id = $1',
      [userId]
    );

    if (libraryResult.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You must own a library to import games' });
      return;
    }

    const targetLibraryId = library_id || libraryResult.rows[0].id;

    // Verify user owns the target library
    const ownerCheck = await pool.query(
      'SELECT id FROM libraries WHERE id = $1 AND owner_id = $2',
      [targetLibraryId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      res.status(403).json({ success: false, error: 'You do not own this library' });
      return;
    }

    // Collect games to import
    let gamesToImport: GameToImport[] = [];

    if (mode === "csv" && csv_data) {
      const rows = parseCSV(csv_data);
      console.log(`Parsed ${rows.length} rows from CSV`);
      
      const isBGGExport = rows.length > 0 && rows[0].objectname !== undefined;
      console.log(`CSV format detected: ${isBGGExport ? 'BGG Export' : 'Standard'}`);
      
      for (const row of rows) {
        // Headers are normalized to lowercase with underscores, so "Game Name" -> "game_name"
        const title = row.title || row.name || row.game || row.game_name || row.game_title || row.objectname;
        
        if (isBGGExport && row.own !== "1") {
          continue;
        }
        
        if (title) {
          const mechanicsStr = row.mechanics || row.mechanic || "";
          const mechanics = mechanicsStr
            .split(";")
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);
          
          const bggId = row.bgg_id || row.objectid || undefined;
          const minPlayersRaw = row.min_players || row.minplayers;
          const maxPlayersRaw = row.max_players || row.maxplayers;
          const playTimeRaw = row.play_time || row.playtime || row.playingtime;
          
          const isExpansion = parseBool(row.is_expansion) || 
                             row.itemtype === "expansion" || 
                             row.objecttype === "expansion";
          
          let difficulty: string | undefined = row.difficulty;
          if (!difficulty) {
            difficulty = mapWeightToDifficulty(row.avgweight || row.weight);
          }
          
          let playTime: string | undefined = row.play_time;
          if (!playTime && playTimeRaw) {
            const playTimeNum = parseNum(playTimeRaw);
            playTime = mapPlayTimeToEnum(playTimeNum);
          }
          
          const suggestedAge = row.suggested_age || row.age || row.bggrecagerange || undefined;
          const isForSale = parseBool(row.is_for_sale || row.fortrade);
          
          const csvDesc = row.description?.trim() || "";
          const csvNotes = buildNotes(
            row.privatecomment || row.private_comment,
            row.comment,
          );

          const gameData: GameToImport = { 
            title,
            bgg_id: bggId,
            bgg_url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : (row.bgg_url || row.url || undefined),
            type: row.type || row.game_type || undefined,
            difficulty,
            play_time: playTime,
            min_players: parseNum(minPlayersRaw),
            max_players: parseNum(maxPlayersRaw),
            suggested_age: suggestedAge,
            publisher: row.publisher || undefined,
            mechanics: mechanics.length > 0 ? mechanics : undefined,
            is_expansion: isExpansion,
            parent_game: row.parent_game || undefined,
            is_coming_soon: parseBool(row.is_coming_soon),
            is_for_sale: isForSale,
            sale_price: parseNum(row.sale_price),
            sale_condition: row.sale_condition || undefined,
            location_room: row.location_room || undefined,
            location_shelf: row.location_shelf || row.invlocation || undefined,
            location_misc: row.location_misc || undefined,
            sleeved: parseBool(row.sleeved),
            upgraded_components: parseBool(row.upgraded_components),
            crowdfunded: parseBool(row.crowdfunded),
            inserts: parseBool(row.inserts),
            in_base_game_box: parseBool(row.in_base_game_box),
            _csv_description: csvDesc,
            _csv_notes: csvNotes,
            description: buildDescriptionWithNotes(csvDesc, csvNotes),
            image_url: row.image_url || row.imageurl || undefined,
            purchase_date: parseDate(row.acquisitiondate || row.acquisition_date || row.purchase_date),
            purchase_price: parsePrice(row.pricepaid || row.price_paid || row.purchase_price),
          };
          
          gamesToImport.push(gameData);
        }
      }
    } else if (mode === "bgg_links" && bgg_links && bgg_links.length > 0) {
      // For BGG links, extract the ID - will be enriched later in processing loop
      for (const link of bgg_links) {
        const idMatch = link.match(/boardgame\/(\d+)/);
        if (idMatch) {
          gamesToImport.push({
            title: "", // Will be fetched from BGG API during processing
            bgg_id: idMatch[1],
            bgg_url: link,
          });
        }
      }
    } else {
      res.status(400).json({ success: false, error: 'Invalid import mode or missing data' });
      return;
    }

    const totalGames = gamesToImport.length;
    console.log(`Processing ${totalGames} games for import...`);
    console.log(`[BulkImport] enhance_with_bgg: ${enhance_with_bgg}`);

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];
    const importedGames: { title: string; id?: string }[] = [];

    // Process each game
    for (let i = 0; i < gamesToImport.length; i++) {
      const gameInput = gamesToImport[i];
      console.log(`[BulkImport] Processing ${i + 1}/${totalGames}: ${gameInput.title || `BGG ID: ${gameInput.bgg_id}`}`);
      
      try {
        // BGG enrichment - fetch additional data from BGG XML API
        // If the CSV has no real description (blank/empty), we fetch the BGG description
        // and then append any CSV comments as "Notes:".
        const csvDesc = (gameInput._csv_description || "").trim();
        const hasCsvDescription = csvDesc.length > 0;
        const hasCompleteData = hasCsvDescription && csvDesc.length > 50;

        const mergeBggData = (bggData: Awaited<ReturnType<typeof fetchBGGXMLData>>): void => {
          if (!bggData) return;

          // Merge BGG data into game input (only fill missing fields)
          if (!gameInput.title && bggData.title) gameInput.title = bggData.title;
          if (isEmpty(gameInput.image_url)) gameInput.image_url = bggData.image_url;

          // Description rules:
          // - If CSV description is missing/blank, use BGG description and append notes.
          // - If CSV description exists, keep it (but still allow notes).
          if (!hasCsvDescription) {
            const merged = buildDescriptionWithNotes(bggData.description, gameInput._csv_notes);
            if (!isEmpty(merged)) gameInput.description = merged;
          } else {
            // Ensure notes are appended even when CSV provided description
            gameInput.description = buildDescriptionWithNotes(csvDesc, gameInput._csv_notes);
          }

          if (isEmpty(gameInput.difficulty)) gameInput.difficulty = bggData.difficulty;
          if (isEmpty(gameInput.play_time)) gameInput.play_time = bggData.play_time;
          if (gameInput.min_players === undefined) gameInput.min_players = bggData.min_players;
          if (gameInput.max_players === undefined) gameInput.max_players = bggData.max_players;
          if (isEmpty(gameInput.suggested_age)) gameInput.suggested_age = bggData.suggested_age;
          if (!gameInput.mechanics?.length && bggData.mechanics?.length) gameInput.mechanics = bggData.mechanics;
          if (isEmpty(gameInput.publisher)) gameInput.publisher = bggData.publisher;

          console.log(
            `[BulkImport] Enriched "${gameInput.title}": image=${!!gameInput.image_url}, desc=${(gameInput.description?.length || 0)} chars (csvDesc=${csvDesc.length}, notes=${gameInput._csv_notes ? gameInput._csv_notes.length : 0})`,
          );
        };

        if (!hasCompleteData && gameInput.bgg_id && enhance_with_bgg !== false) {
          console.log(`[BulkImport] Fetching BGG data for: ${gameInput.bgg_id}`);
          try {
            const bggData = await fetchBGGXMLData(gameInput.bgg_id);
            mergeBggData(bggData);
          } catch (e) {
            console.warn(`[BulkImport] BGG fetch failed for ${gameInput.bgg_id}:`, e);
          }
        } else if (enhance_with_bgg !== false && gameInput.title && !hasCompleteData) {
          // No BGG ID - try to look up by title using XML search
          console.log(`[BulkImport] Looking up BGG by title: ${gameInput.title}`);
          try {
            const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameInput.title)}&type=boardgame&exact=1`;
            const searchRes = await fetch(searchUrl, {
              headers: { "User-Agent": "GameTaverns/1.0 (Bulk Import)" },
            });
            if (searchRes.ok) {
              const xml = await searchRes.text();
              const idMatch = xml.match(/<item[^>]*id="(\d+)"/);
              if (idMatch) {
                const foundId = idMatch[1];
                gameInput.bgg_id = foundId;
                gameInput.bgg_url = `https://boardgamegeek.com/boardgame/${foundId}`;

                const bggData = await fetchBGGXMLData(foundId);
                mergeBggData(bggData);
              }
            }
          } catch (e) {
            console.warn(`[BulkImport] Title lookup failed for "${gameInput.title}":`, e);
          }
        }
        
        // Skip games without title (can happen with BGG links mode if fetch failed)
        if (!gameInput.title) {
          failed++;
          errors.push(`Could not determine title for BGG ID: ${gameInput.bgg_id}`);
          continue;
        }

        // Check if game already exists
        const existingResult = await pool.query(
          'SELECT id FROM games WHERE title = $1 AND library_id = $2',
          [gameInput.title, targetLibraryId]
        );

        if (existingResult.rows.length > 0) {
          failed++;
          errors.push(`"${gameInput.title}" already exists`);
          continue;
        }

        // Handle publisher
        let publisherId: string | null = null;
        if (gameInput.publisher) {
          const pubResult = await pool.query(
            'SELECT id FROM publishers WHERE name = $1',
            [gameInput.publisher]
          );
          
          if (pubResult.rows.length > 0) {
            publisherId = pubResult.rows[0].id;
          } else {
            const newPubResult = await pool.query(
              'INSERT INTO publishers (id, name) VALUES ($1, $2) RETURNING id',
              [crypto.randomUUID(), gameInput.publisher]
            );
            publisherId = newPubResult.rows[0].id;
          }
        }

        // Handle parent game for expansions
        let parentGameId: string | null = null;
        if (gameInput.is_expansion && gameInput.parent_game) {
          const pgResult = await pool.query(
            'SELECT id FROM games WHERE title = $1 AND library_id = $2',
            [gameInput.parent_game, targetLibraryId]
          );
          
          if (pgResult.rows.length > 0) {
            parentGameId = pgResult.rows[0].id;
          }
        }

        // Generate unique slug
        let baseSlug = generateSlug(gameInput.title);
        let slug = baseSlug;
        let slugCounter = 1;
        while (true) {
          const slugCheck = await pool.query(
            'SELECT id FROM games WHERE slug = $1 AND library_id = $2',
            [slug, targetLibraryId]
          );
          if (slugCheck.rows.length === 0) break;
          slug = `${baseSlug}-${slugCounter++}`;
        }

        // Create the game
        const gameId = crypto.randomUUID();
        const insertResult = await pool.query(
          `INSERT INTO games (
            id, library_id, title, slug, description, image_url, bgg_id, bgg_url,
            min_players, max_players, suggested_age, play_time, difficulty, game_type,
            publisher_id, is_expansion, parent_game_id, is_coming_soon, is_for_sale,
            sale_price, sale_condition, location_room, location_shelf, location_misc,
            sleeved, upgraded_components, crowdfunded, inserts, in_base_game_box
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
          ) RETURNING id, title`,
          [
            gameId,
            targetLibraryId,
            gameInput.title,
            slug,
            gameInput.description || null,
            gameInput.image_url || null,
            gameInput.bgg_id || null,
            gameInput.bgg_url || null,
            gameInput.min_players ?? 2,
            gameInput.max_players ?? 4,
            gameInput.suggested_age || null,
            gameInput.play_time || "45-60 Minutes",
            gameInput.difficulty || "3 - Medium",
            gameInput.type || "Board Game",
            publisherId,
            gameInput.is_expansion ?? false,
            parentGameId,
            gameInput.is_coming_soon ?? default_options?.is_coming_soon ?? false,
            gameInput.is_for_sale ?? default_options?.is_for_sale ?? false,
            gameInput.sale_price ?? default_options?.sale_price ?? null,
            gameInput.sale_condition ?? default_options?.sale_condition ?? null,
            gameInput.location_room ?? default_options?.location_room ?? null,
            gameInput.location_shelf ?? default_options?.location_shelf ?? null,
            gameInput.location_misc ?? default_options?.location_misc ?? null,
            gameInput.sleeved ?? default_options?.sleeved ?? false,
            gameInput.upgraded_components ?? default_options?.upgraded_components ?? false,
            gameInput.crowdfunded ?? default_options?.crowdfunded ?? false,
            gameInput.inserts ?? default_options?.inserts ?? false,
            gameInput.in_base_game_box ?? false,
          ]
        );

        const newGame = insertResult.rows[0];

        // Handle mechanics
        if (gameInput.mechanics?.length) {
          for (const mechName of gameInput.mechanics) {
            // Find or create mechanic
            let mechResult = await pool.query(
              'SELECT id FROM mechanics WHERE name = $1',
              [mechName]
            );
            
            let mechId: string;
            if (mechResult.rows.length > 0) {
              mechId = mechResult.rows[0].id;
            } else {
              const newMechResult = await pool.query(
                'INSERT INTO mechanics (id, name) VALUES ($1, $2) RETURNING id',
                [crypto.randomUUID(), mechName]
              );
              mechId = newMechResult.rows[0].id;
            }

            // Link game to mechanic
            await pool.query(
              'INSERT INTO game_mechanics (id, game_id, mechanic_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [crypto.randomUUID(), newGame.id, mechId]
            );
          }
        }

        // Create admin data if purchase info exists
        if (gameInput.purchase_date || gameInput.purchase_price) {
          await pool.query(
            'INSERT INTO game_admin_data (id, game_id, purchase_date, purchase_price) VALUES ($1, $2, $3, $4)',
            [crypto.randomUUID(), newGame.id, gameInput.purchase_date || null, gameInput.purchase_price || null]
          );
        }

        imported++;
        importedGames.push({ title: newGame.title, id: newGame.id });
        console.log(`Imported: ${newGame.title}`);

      } catch (e) {
        console.error("Game import error:", e);
        failed++;
        errors.push(`Error importing "${gameInput.title || gameInput.bgg_id}": ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }

    res.json({
      success: imported > 0,
      imported,
      failed,
      errors: errors.slice(0, 50), // Limit errors to first 50
      games: importedGames,
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ success: false, error: 'Failed to process import' });
  }
});

export default router;
