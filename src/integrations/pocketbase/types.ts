/**
 * PocketBase Collection Types
 * 
 * These types mirror the database schema for type-safe queries.
 */

import type { RecordModel } from 'pocketbase';

// Enums (matching existing Supabase enums)
export type DifficultyLevel = '1 - Light' | '2 - Medium Light' | '3 - Medium' | '4 - Medium Heavy' | '5 - Heavy';
export type GameType = 'Board Game' | 'Card Game' | 'Dice Game' | 'Party Game' | 'War Game' | 'Miniatures' | 'RPG' | 'Other';
export type PlayTime = '0-15 Minutes' | '15-30 Minutes' | '30-45 Minutes' | '45-60 Minutes' | '60+ Minutes' | '2+ Hours' | '3+ Hours';
export type SaleCondition = 'New/Sealed' | 'Like New' | 'Very Good' | 'Good' | 'Acceptable';
export type AppRole = 'admin' | 'moderator' | 'user';

// Base record with PocketBase fields
interface BaseRecord extends RecordModel {
  id: string;
  created: string;
  updated: string;
}

// Users collection (PocketBase built-in, extended)
export interface User extends BaseRecord {
  email: string;
  username?: string;
  name?: string;
  avatar?: string;
  role: AppRole;
  verified: boolean;
}

// Games collection
export interface Game extends BaseRecord {
  title: string;
  slug: string;
  description?: string;
  image_url?: string;
  additional_images: string[];
  difficulty: DifficultyLevel;
  game_type: GameType;
  play_time: PlayTime;
  min_players: number;
  max_players: number;
  suggested_age: string;
  publisher?: string; // Relation ID
  bgg_id?: string;
  bgg_url?: string;
  is_coming_soon: boolean;
  is_for_sale: boolean;
  sale_price?: number;
  sale_condition?: SaleCondition;
  is_expansion: boolean;
  parent_game?: string; // Relation ID
  in_base_game_box: boolean;
  location_room?: string;
  location_shelf?: string;
  location_misc?: string;
  sleeved: boolean;
  upgraded_components: boolean;
  crowdfunded: boolean;
  inserts: boolean;
  youtube_videos: string[];
  mechanics: string[]; // Relation IDs
  // Admin-only fields (only returned for admin users)
  purchase_price?: number;
  purchase_date?: string;
}

// Expanded game with relations loaded
export interface GameExpanded extends Game {
  expand?: {
    publisher?: Publisher;
    parent_game?: Game;
    mechanics?: Mechanic[];
  };
}

// Publishers collection
export interface Publisher extends BaseRecord {
  name: string;
}

// Mechanics collection
export interface Mechanic extends BaseRecord {
  name: string;
}

// Game Sessions collection
export interface GameSession extends BaseRecord {
  game: string; // Relation ID
  played_at: string;
  duration_minutes?: number;
  notes?: string;
  players: string[]; // Relation IDs to session_players
}

// Session Players collection
export interface SessionPlayer extends BaseRecord {
  session: string; // Relation ID
  player_name: string;
  score?: number;
  is_winner: boolean;
  is_first_play: boolean;
}

// Game Wishlist collection
export interface GameWishlist extends BaseRecord {
  game: string; // Relation ID
  guest_identifier: string;
  guest_name?: string;
}

// Game Messages collection
export interface GameMessage extends BaseRecord {
  game: string; // Relation ID
  sender_name: string;
  sender_email: string;
  sender_ip?: string;
  message: string;
  is_read: boolean;
}

// Site Settings collection
export interface SiteSetting extends BaseRecord {
  key: string;
  value?: string;
}

// Collection names for type-safe queries
export const Collections = {
  USERS: 'users',
  GAMES: 'games',
  PUBLISHERS: 'publishers',
  MECHANICS: 'mechanics',
  GAME_SESSIONS: 'game_sessions',
  SESSION_PLAYERS: 'session_players',
  GAME_WISHLIST: 'game_wishlist',
  GAME_MESSAGES: 'game_messages',
  SITE_SETTINGS: 'site_settings',
} as const;
