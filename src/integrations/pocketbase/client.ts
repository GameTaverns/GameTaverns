/**
 * PocketBase Client
 * 
 * Single-file database with built-in auth and admin UI.
 * Replaces Supabase for a simpler, more portable self-hosted solution.
 */

import PocketBase from 'pocketbase';
import { getConfig } from '@/config/runtime';

// Get PocketBase URL from runtime config or environment
const POCKETBASE_URL = getConfig('POCKETBASE_URL' as any, 'VITE_POCKETBASE_URL', 'http://127.0.0.1:8090');

// Create and export the PocketBase client
export const pb = new PocketBase(POCKETBASE_URL);

// Auto-refresh auth token
pb.autoCancellation(false);

// Helper to check if user is authenticated
export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

// Helper to get current user ID
export function getCurrentUserId(): string | null {
  return pb.authStore.model?.id || null;
}

// Helper to check if current user is admin
export function isAdmin(): boolean {
  return pb.authStore.model?.role === 'admin';
}
