export type DifficultyLevel = '1 - Light' | '2 - Medium Light' | '3 - Medium' | '4 - Medium Heavy' | '5 - Heavy';
export type GameType = 'Board Game' | 'Card Game' | 'Dice Game' | 'Party Game' | 'War Game' | 'Miniatures' | 'RPG' | 'Other';
export type PlayTime = '0-15 Minutes' | '15-30 Minutes' | '30-45 Minutes' | '45-60 Minutes' | '60+ Minutes' | '2+ Hours' | '3+ Hours';
export type SaleCondition = 'New/Sealed' | 'Like New' | 'Very Good' | 'Good' | 'Acceptable';

export interface Mechanic {
  id: string;
  name: string;
}

export interface Publisher {
  id: string;
  name: string;
}

export interface Game {
  id: string;
  slug?: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  additional_images: string[];
  difficulty: DifficultyLevel;
  game_type: GameType;
  play_time: PlayTime;
  min_players: number;
  max_players: number;
  suggested_age: string;
  publisher_id: string | null;
  bgg_id: string | null;
  bgg_url: string | null;
  is_coming_soon: boolean;
  is_for_sale: boolean;
  sale_price: number | null;
  sale_condition: SaleCondition | null;
  is_expansion: boolean;
  parent_game_id: string | null;
  in_base_game_box: boolean;
  location_room?: string | null;
  location_shelf?: string | null;
  location_misc?: string | null;
  sleeved: boolean;
  upgraded_components: boolean;
  crowdfunded: boolean;
  inserts?: boolean;
  youtube_videos: string[];
  created_at: string;
  updated_at: string;
}

export interface GameAdminData {
  id: string;
  game_id: string;
  purchase_price: number | null;
  purchase_date: string | null;
}

export interface GameWithRelations extends Game {
  publisher: Publisher | null;
  mechanics: Mechanic[];
  expansions?: GameWithRelations[];
  parent_game?: { id: string; title: string; slug: string | null } | null;
  admin_data?: GameAdminData | null;
}

export const DIFFICULTY_OPTIONS: DifficultyLevel[] = [
  '1 - Light',
  '2 - Medium Light',
  '3 - Medium',
  '4 - Medium Heavy',
  '5 - Heavy'
];

export const GAME_TYPE_OPTIONS: GameType[] = [
  'Board Game',
  'Card Game',
  'Dice Game',
  'Party Game',
  'War Game',
  'Miniatures',
  'RPG',
  'Other'
];

export const PLAY_TIME_OPTIONS: PlayTime[] = [
  '0-15 Minutes',
  '15-30 Minutes',
  '30-45 Minutes',
  '45-60 Minutes',
  '60+ Minutes',
  '2+ Hours',
  '3+ Hours'
];

export const SALE_CONDITION_OPTIONS: SaleCondition[] = [
  'New/Sealed',
  'Like New',
  'Very Good',
  'Good',
  'Acceptable'
];
