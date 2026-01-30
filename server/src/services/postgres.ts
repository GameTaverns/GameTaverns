import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Connection pool for PostgreSQL (standalone multi-tenant mode)
let pool: pg.Pool | null = null;

export interface TenantContext {
  slug: string;
  id: string;
  name: string;
  ownerId: string;
}

/**
 * Initialize the PostgreSQL connection pool
 */
export async function initializePostgres(): Promise<pg.Pool> {
  if (pool) return pool;
  
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✓ PostgreSQL connected');
  } catch (error) {
    console.error('✗ PostgreSQL connection failed:', error);
    throw error;
  }
  
  return pool;
}

/**
 * Get the database pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializePostgres() first.');
  }
  return pool;
}

/**
 * Resolve tenant from subdomain
 * 
 * Supports domain structures:
 * 1. gametaverns.com (production): library.gametaverns.com → 'library'
 * 2. Custom domains via custom_domain column
 */
export async function resolveTenant(hostname: string): Promise<TenantContext | null> {
  const parts = hostname.split('.');
  
  // For local development, skip
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    return null;
  }
  
  let slug: string | null = null;
  
  // Check for production domain: gametaverns.com  
  if (hostname.endsWith('.gametaverns.com') || hostname.endsWith('gametaverns.com')) {
    if (parts.length === 3) {
      slug = parts[0];
    } else {
      return null; // Main site
    }
  }
  // Check for custom domain
  else {
    // Look up by custom_domain
    try {
      const dbPool = getPool();
      const result = await dbPool.query<{id: string; slug: string; name: string; owner_id: string}>(
        'SELECT id, slug, name, owner_id FROM libraries WHERE custom_domain = $1 AND is_active = true',
        [hostname]
      );
      
      if (result.rows.length > 0) {
        return {
          id: result.rows[0].id,
          slug: result.rows[0].slug,
          name: result.rows[0].name,
          ownerId: result.rows[0].owner_id,
        };
      }
    } catch (error) {
      console.error('Error looking up custom domain:', error);
    }
    return null;
  }
  
  // Skip reserved subdomains
  if (!slug || ['www', 'api', 'mail', 'admin', 'tavern', 'app', 'help', 'support', 'blog'].includes(slug)) {
    return null;
  }
  
  // Look up tenant in database
  try {
    const dbPool = getPool();
    const result = await dbPool.query<{id: string; slug: string; name: string; owner_id: string}>(
      'SELECT id, slug, name, owner_id FROM libraries WHERE slug = $1 AND is_active = true',
      [slug]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return {
      id: result.rows[0].id,
      slug: result.rows[0].slug,
      name: result.rows[0].name,
      ownerId: result.rows[0].owner_id,
    };
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }
}

/**
 * Execute a query with parameters
 */
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const dbPool = getPool();
  const result = await dbPool.query<T>(sql, params);
  return result.rows;
}

/**
 * Execute a query that returns a single row
 */
export async function queryOne<T extends pg.QueryResultRow>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

/**
 * Transaction wrapper
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const dbPool = getPool();
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL pool closed');
  }
}
