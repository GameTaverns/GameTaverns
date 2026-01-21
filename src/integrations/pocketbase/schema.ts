/**
 * PocketBase Schema Definition
 * 
 * This file documents the expected PocketBase collections and can be used
 * to generate the schema via the PocketBase admin UI or migrations.
 * 
 * To set up PocketBase:
 * 1. Download PocketBase from https://pocketbase.io/docs
 * 2. Run: ./pocketbase serve
 * 3. Open admin UI at http://127.0.0.1:8090/_/
 * 4. Create collections as defined below
 */

export const schemaDefinition = {
  collections: [
    {
      name: 'users',
      type: 'auth',
      schema: [
        { name: 'name', type: 'text' },
        { name: 'avatar', type: 'file', maxSelect: 1 },
        { name: 'role', type: 'select', options: { values: ['admin', 'moderator', 'user'] } },
      ],
      // API Rules (similar to RLS)
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.id = id || @request.auth.role = "admin"',
      createRule: '',  // Allow signups
      updateRule: '@request.auth.id = id || @request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'games',
      type: 'base',
      schema: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', unique: true },
        { name: 'description', type: 'editor' },
        { name: 'image_url', type: 'url' },
        { name: 'additional_images', type: 'json', default: '[]' },
        { name: 'difficulty', type: 'select', options: { values: ['1 - Light', '2 - Medium Light', '3 - Medium', '4 - Medium Heavy', '5 - Heavy'] } },
        { name: 'game_type', type: 'select', options: { values: ['Board Game', 'Card Game', 'Dice Game', 'Party Game', 'War Game', 'Miniatures', 'RPG', 'Other'] } },
        { name: 'play_time', type: 'select', options: { values: ['0-15 Minutes', '15-30 Minutes', '30-45 Minutes', '45-60 Minutes', '60+ Minutes', '2+ Hours', '3+ Hours'] } },
        { name: 'min_players', type: 'number', default: 1 },
        { name: 'max_players', type: 'number', default: 4 },
        { name: 'suggested_age', type: 'text', default: '10+' },
        { name: 'publisher', type: 'relation', collection: 'publishers' },
        { name: 'mechanics', type: 'relation', collection: 'mechanics', maxSelect: 999 },
        { name: 'bgg_id', type: 'text' },
        { name: 'bgg_url', type: 'url' },
        { name: 'is_coming_soon', type: 'bool', default: false },
        { name: 'is_for_sale', type: 'bool', default: false },
        { name: 'sale_price', type: 'number' },
        { name: 'sale_condition', type: 'select', options: { values: ['New/Sealed', 'Like New', 'Very Good', 'Good', 'Acceptable'] } },
        { name: 'is_expansion', type: 'bool', default: false },
        { name: 'parent_game', type: 'relation', collection: 'games' },
        { name: 'in_base_game_box', type: 'bool', default: false },
        { name: 'location_room', type: 'text' },
        { name: 'location_shelf', type: 'text' },
        { name: 'location_misc', type: 'text' },
        { name: 'sleeved', type: 'bool', default: false },
        { name: 'upgraded_components', type: 'bool', default: false },
        { name: 'crowdfunded', type: 'bool', default: false },
        { name: 'inserts', type: 'bool', default: false },
        { name: 'youtube_videos', type: 'json', default: '[]' },
        // Admin-only fields
        { name: 'purchase_price', type: 'number' },
        { name: 'purchase_date', type: 'date' },
      ],
      // Public can view non-sensitive fields, admins can do everything
      listRule: '',  // Public read
      viewRule: '',  // Public read
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'publishers',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true, unique: true },
      ],
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'mechanics',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true, unique: true },
      ],
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'game_sessions',
      type: 'base',
      schema: [
        { name: 'game', type: 'relation', collection: 'games', required: true },
        { name: 'played_at', type: 'date', required: true },
        { name: 'duration_minutes', type: 'number' },
        { name: 'notes', type: 'text' },
      ],
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'session_players',
      type: 'base',
      schema: [
        { name: 'session', type: 'relation', collection: 'game_sessions', required: true, cascadeDelete: true },
        { name: 'player_name', type: 'text', required: true },
        { name: 'score', type: 'number' },
        { name: 'is_winner', type: 'bool', default: false },
        { name: 'is_first_play', type: 'bool', default: false },
      ],
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'game_wishlist',
      type: 'base',
      schema: [
        { name: 'game', type: 'relation', collection: 'games', required: true },
        { name: 'guest_identifier', type: 'text', required: true },
        { name: 'guest_name', type: 'text' },
      ],
      // Unique constraint: one vote per guest per game
      indexes: ['CREATE UNIQUE INDEX idx_wishlist_unique ON game_wishlist (game, guest_identifier)'],
      listRule: '',
      viewRule: '',
      createRule: '',  // Anyone can vote
      updateRule: '',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'game_messages',
      type: 'base',
      schema: [
        { name: 'game', type: 'relation', collection: 'games', required: true },
        { name: 'sender_name', type: 'text', required: true },
        { name: 'sender_email', type: 'email', required: true },
        { name: 'sender_ip', type: 'text' },
        { name: 'message', type: 'text', required: true },
        { name: 'is_read', type: 'bool', default: false },
      ],
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '',  // Anyone can send messages
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      name: 'site_settings',
      type: 'base',
      schema: [
        { name: 'key', type: 'text', required: true, unique: true },
        { name: 'value', type: 'text' },
      ],
      // Non-sensitive settings are public, admin can modify
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
  ],
};

/**
 * Generate SQL-like schema for documentation
 */
export function generateSchemaDoc(): string {
  return schemaDefinition.collections
    .map(c => `-- Collection: ${c.name} (${c.type})\n${c.schema.map(f => `--   ${f.name}: ${f.type}${f.required ? ' NOT NULL' : ''}`).join('\n')}`)
    .join('\n\n');
}
