# GameTaverns: Migration Guide

**Version:** 2.1.1  
**Last Updated:** 2026-01-31
**Last Audit:** 2026-01-31

This guide covers migrating from existing deployments to the new self-hosted Supabase stack.

## Important: Database Isolation

**The self-hosted deployment uses a completely fresh database.**

This stack is 100% isolated from:
- Lovable Cloud (Supabase hosted)
- The previous native Express deployment
- Any other GameTaverns instance

No data is shared or synced between environments.

## Migration Paths

### From Lovable Cloud (Supabase Hosted)

If you're running on Lovable Cloud and want to migrate to self-hosted:

1. **Export your data from Lovable Cloud:**
   - Use the Supabase dashboard to export tables as CSV
   - Or use `pg_dump` if you have direct database access

2. **Install the self-hosted stack:**
   ```bash
   sudo ./install.sh
   ```

3. **Import your data:**
   ```bash
   # Copy your export files to the server
   scp exports/*.csv root@your-server:/opt/gametaverns/

   # Import into the new database
   docker compose exec -T db psql -U supabase_admin -d postgres << 'EOF'
   \copy public.libraries FROM '/path/to/libraries.csv' CSV HEADER;
   \copy public.games FROM '/path/to/games.csv' CSV HEADER;
   -- etc for other tables
   EOF
   ```

4. **Migrate auth users:**
   - Users will need to create new accounts (passwords are hashed)
   - Or export/import the `auth.users` table if you have access

### From Native Express Deployment

If you're migrating from the native PostgreSQL/Express deployment:

1. **Export from native PostgreSQL:**
   ```bash
   pg_dump -U gametaverns -d gametaverns \
       --no-owner --no-privileges \
       --data-only \
       -f /tmp/native-export.sql
   ```

2. **Review table differences:**
   The native schema should be compatible, but verify:
   - Column names match
   - Enums are consistent
   - Foreign keys align

3. **Install self-hosted stack:**
   ```bash
   sudo ./install.sh
   ```

4. **Import data:**
   ```bash
   # Copy export to server
   scp /tmp/native-export.sql root@server:/opt/gametaverns/

   # Import (after migrations have run)
   docker compose exec -T db psql -U supabase_admin -d postgres \
       < /opt/gametaverns/native-export.sql
   ```

5. **Migrate file uploads:**
   ```bash
   # Copy uploads from native to storage volume
   scp -r /opt/gametaverns/uploads/* root@server:/opt/gametaverns/volumes/storage/
   ```

6. **Update file URLs:**
   File URLs will change from `/uploads/...` to storage bucket URLs.
   You may need to run a migration script:
   ```sql
   UPDATE public.games
   SET image_url = REPLACE(image_url, '/uploads/', '/storage/v1/object/public/')
   WHERE image_url LIKE '/uploads/%';
   ```

### From Scratch (New Installation)

For a fresh installation with no data migration:

```bash
# 1. Configure DNS for gametaverns.com
# 2. Run installer
sudo ./install.sh

# 3. Setup SSL
sudo ./scripts/setup-ssl.sh

# 4. Create admin
sudo ./scripts/create-admin.sh

# 5. Done! Visit https://gametaverns.com
```

## User Migration

### Auth Users

Supabase Auth stores users in the `auth.users` table with:
- Hashed passwords (bcrypt)
- Email confirmation status
- Metadata

**Options:**
1. **Fresh start**: Users create new accounts
2. **Password reset**: Import emails, users reset passwords
3. **Full migration**: Export/import `auth.users` (requires service role access)

### User Profiles

User profiles are in `public.user_profiles`:
```sql
-- Export from old database
\copy (SELECT * FROM public.user_profiles) TO '/tmp/profiles.csv' CSV HEADER;

-- Import to new database
\copy public.user_profiles FROM '/tmp/profiles.csv' CSV HEADER;
```

## Post-Migration Checklist

After migration, verify:

- [ ] All libraries appear in directory
- [ ] Games are visible with correct images
- [ ] User can log in (or reset password)
- [ ] Library settings are preserved
- [ ] Theme customizations work
- [ ] File uploads are accessible
- [ ] API keys are configured (Discord, AI, Turnstile)
- [ ] Email sending works
- [ ] SSL certificates are valid
- [ ] Tenant subdomains work (e.g., tzolak.gametaverns.com)

## Rollback

If migration fails, you can always:

1. Keep the old deployment running
2. Delete the self-hosted stack:
   ```bash
   cd /opt/gametaverns
   docker compose down -v
   rm -rf /opt/gametaverns
   ```
3. Debug and try again

## Support

- Check `TROUBLESHOOTING.md` for common issues
- Check `README.md` for installation overview
- GitHub Issues: https://github.com/GameTaverns/GameTaverns/issues
- Discord: https://discord.gg/gametaverns
