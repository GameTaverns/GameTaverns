# GameTaverns Changelog

All notable changes to GameTaverns are documented in this file.  
Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## [2.4.0] — 2026-02-15

### Added
- **Forum Subcategories** — 2-level nesting under forum categories (e.g. Marketplace → Buying, Selling, Trading)
- **Rich Text Editor** — Tiptap-based editor for forum posts with bold, italic, underline, headings, lists, blockquotes, and image embedding
- **Auto-seed Library Forums** — New libraries automatically receive 4 default forum categories + marketplace subcategories via database trigger
- **Owner Quick Actions Bar** — Direct shortcuts for Edit Collection, Add Game, Library Settings, and Play Stats on the library home page
- **Feature Discovery Tips** — Dismissible tooltip system to guide library owners toward management tools
- **Sidebar Navigation Enhancements** — Direct links for Edit Collection, Add Game, and Library Settings for authenticated owners

### Changed
- Global font size increased ~20% across the site for improved readability
- Query caching improved: 5-minute stale time, disabled refetch-on-window-focus
- Tiptap dependencies code-split into a separate chunk for lazy loading

### Fixed
- Backfilled forum categories for all existing libraries that were missing them
- Updated `seed_club_forum_categories` trigger to also seed marketplace subcategories

### Database
- Migration 55: `parent_category_id` column on `forum_categories`, marketplace subcategory seeding
- Migration 56: `seed_library_forum_categories` trigger + backfill

---

## [2.3.2] — 2026-02-02

### Added
- **Club Forum RLS** — Dedicated RLS policies for club-scoped forum categories
- **Club Forum Auto-Seeding** — Trigger to auto-seed 4 default forum categories when a club is approved (Announcements, General, LFG, Marketplace)

### Database
- Migration 53: Club forum RLS policies
- Migration 54: `seed_club_forum_categories` trigger

---

## [2.3.1] — 2026-01-30

### Added
- **Game Catalog** — Centralized game catalog (`game_catalog` table) with publishers, mechanics, corrections, and videos
- **Community Voting** — Upvote/downvote system for catalog videos
- **Catalog Corrections** — Users can suggest corrections to catalog entries for admin review
- **Shame & Tour Achievements** — New achievement categories for collection milestones
- **Unplayed Games Tracking** — `is_unplayed` flag on games for "shelf of shame" tracking

### Changed
- Cleanup cron job for stuck imports (auto-fail after 30 minutes)

### Database
- Migration 50: Game catalog tables, publishers, mechanics, corrections, videos
- Migration 51: Shame achievement seeds
- Migration 52: Tour achievement seeds
- Migration 48: `is_unplayed` column
- Migration 49: Stuck import cleanup cron

---

## [2.3.0] — 2026-01-25

### Added
- **BGG Community Ratings** — Display BoardGameGeek community ratings on games
- **System Logs** — Platform-wide system logging with severity levels, admin-only access
- **Import Job Admin Policies** — Platform admins can view all import jobs
- **Import Skipped Count** — Track skipped items during bulk imports
- **Import Type Column** — Differentiate between BGG collection, BGG plays, and manual imports

### Changed
- BGG sync configuration moved to library settings with configurable frequency and removal behavior

### Database
- Migration 41: BGG sync config columns on `library_settings`
- Migration 42: `import_type` column on `import_jobs`
- Migration 43: System logs columns
- Migration 44: `bgg_community_rating` on `game_catalog`
- Migration 45: System logs RLS policies
- Migration 46: Import jobs admin policies
- Migration 47: `skipped_items` column on `import_jobs`

---

## [2.2.0] — 2026-01-20

### Added
- **Clubs** — Cross-library networking layer with invite codes, shared catalogs, events, and forums
- **Announcement Banner** — Library-wide announcement banner view for owners
- **Game Copies Inventory** — Track multiple copies of the same game with condition, labels, and notes

### Changed
- Lending system now supports copy-level tracking (loans reference specific copies)

### Fixed
- Loan trigger enum compatibility fix
- Loan status enum alignment between app and database

### Database
- Migration 35: `game_copies` table
- Migration 36: Loan trigger enum fix
- Migration 37: Loan status enum alignment
- Migration 38: Lending enhancements (waitlist, borrower ratings, copy-level loans)
- Migration 39: Clubs tables (clubs, club_libraries, club_events, club_invite_codes)
- Migration 40: Announcement banner view

---

## [2.1.0] — 2026-01-15

### Added
- **BGG Play Import** — Import play history from BoardGameGeek
- **Collection Value Tracking** — Track purchase prices and collection value via `game_admin_data`
- **Group Challenges** — Community challenges with progress tracking
- **Trade Matching** — Automated trade matching between libraries based on wishlists and for-sale items
- **Player Colors** — Color assignment for players in play sessions
- **Theme Foreground Colors** — Customizable text/foreground colors in library themes

### Database
- Migration 28: BGG play import tables
- Migration 29: Collection value tracking (`game_admin_data`)
- Migration 30: Group challenges tables
- Migration 31: Trade matching tables
- Migration 32: `color` column on `game_session_players`
- Migration 33: Theme foreground color columns on `library_settings`
- Migration 34: Public view foreground fix

---

## [2.0.0] — 2026-01-10

### Added
- **Community Forums** — Full forum system with categories, threads, and replies
- **Realtime Notifications** — In-app notification system with real-time delivery
- **Forum Category Seeding** — Default site-wide forum categories (Announcements, General, LFG, Marketplace)
- **Achievement Sync** — Automatic achievement progress recalculation

### Fixed
- Forum categories RLS policy conflicts resolved
- Forum PostgREST schema cache compatibility

### Database
- Migration 22: Forum tables (categories, threads, replies)
- Migration 23: Notifications realtime setup
- Migration 24: Seed forum categories
- Migration 25: Forum PostgREST schema fix
- Migration 26: Achievement sync functions
- Migration 27: Forum categories RLS fix

---

## [1.5.0] — 2026-01-05

### Added
- **TOTP Two-Factor Authentication** — Time-based OTP support for user accounts
- **Featured Achievements** — Users can pin a featured achievement to their profile

### Changed
- Security hardening pass: tightened RLS policies across all tables
- Storage grants fix for self-hosted compatibility
- Library settings insert policy for new library creation

### Fixed
- Libraries RLS recursion issue resolved

### Database
- Migration 15: TOTP 2FA tables
- Migration 16: Security hardening
- Migration 17: RLS fixes
- Migration 18: Storage grants fix
- Migration 19: Library settings insert policy
- Migration 20: Featured achievement column
- Migration 21: Libraries RLS recursion fix

---

## [1.0.0] — 2025-12-20

### Added
- **Core Platform** — Multi-tenant board game library management
- **Libraries** — Create and manage game libraries with custom slugs and domains
- **Games** — Full game management with metadata, images, expansions, and parent-child relationships
- **Events & Polls** — Game night planning with polls, voting, and RSVP
- **Achievements** — Gamification system with categories, tiers, and secret achievements
- **Notifications** — In-app notification logging
- **Platform Administration** — Admin roles, user management, system settings
- **Game Sessions** — Play logging with player tracking, scores, winners, and first-play flags
- **Messaging** — Encrypted game inquiry system with replies
- **Wishlist** — Guest wishlisting for games
- **Ratings** — Community game ratings with fingerprint-based deduplication
- **Lending** — Game lending system with loan tracking, approvals, and returns
- **Library Members** — Member and moderator roles per library
- **Library Followers** — Follow libraries for updates
- **Storage** — Library logo uploads via Supabase Storage
- **Auth** — User registration with email confirmation, profile creation trigger
- **Theming** — Full HSL-based theme customization per library (light + dark modes)
- **BGG Integration** — BoardGameGeek import and lookup
- **Discord Integration** — Webhook notifications, bot DMs, scheduled events, forum threads
- **Views** — Public library directory, game ratings summary, calendar events

### Database
- Migrations 01–13: Core schema, extensions, enums, tables, functions, triggers, views, RLS, seed data, auth, storage
