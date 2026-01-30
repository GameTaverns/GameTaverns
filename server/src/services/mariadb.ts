import mysql from 'mysql2/promise';
import { config } from '../config.js';

// Connection pool for the core database
let corePool: mysql.Pool | null = null;

// Cache of tenant connection pools
const tenantPools: Map<string, mysql.Pool> = new Map();

export interface TenantContext {
  slug: string;
  id: string;
  schemaName: string;
}

/**
 * Initialize the core database connection pool
 */
export async function initializeCoreDb(): Promise<mysql.Pool> {
  if (corePool) return corePool;
  
  // Use DATABASE_URL if available, otherwise construct from parts
  const connectionString = config.databaseUrl || 
    `mysql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/gametaverns_core`;
  
  corePool = mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
  
  // Test connection
  try {
    const conn = await corePool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('✓ MariaDB core database connected');
  } catch (error) {
    console.error('✗ MariaDB core connection failed:', error);
    throw error;
  }
  
  return corePool;
}

/**
 * Get or create a connection pool for a specific tenant
 */
export async function getTenantPool(tenantSlug: string): Promise<mysql.Pool> {
  if (tenantPools.has(tenantSlug)) {
    return tenantPools.get(tenantSlug)!;
  }
  
  const schemaName = `tenant_${tenantSlug}`;
  
  // Use same connection but different database
  const connectionString = config.databaseUrl?.replace(
    /\/gametaverns_core/, 
    `/${schemaName}`
  ) || `mysql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${schemaName}`;
  
  const pool = mysql.createPool({
    uri: connectionString,
    waitForConnections: true,
    connectionLimit: 10,  // Lower limit per tenant
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
  
  // Verify the schema exists
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    tenantPools.set(tenantSlug, pool);
    console.log(`✓ Tenant pool created: ${schemaName}`);
  } catch (error) {
    console.error(`✗ Failed to connect to tenant schema ${schemaName}:`, error);
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }
  
  return pool;
}

/**
 * Get the core database pool
 */
export function getCorePool(): mysql.Pool {
  if (!corePool) {
    throw new Error('Core database not initialized. Call initializeCoreDb() first.');
  }
  return corePool;
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
  
  // For local development, check for tenant query param instead
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    return null;
  }
  
  let slug: string | null = null;
  
  // Check for production domain: gametaverns.com  
  // library.gametaverns.com = 3 parts → slug = 'library'
  // gametaverns.com = 2 parts → main site
  if (hostname.endsWith('.gametaverns.com') || hostname.endsWith('gametaverns.com')) {
    if (parts.length === 3) {
      slug = parts[0];
    } else {
      return null; // Main site
    }
  }
  // Unknown domain structure
  else {
    return null;
  }
  
  // Skip common non-tenant subdomains
  if (!slug || ['www', 'api', 'mail', 'admin', 'tavern'].includes(slug)) {
    return null;
  }
  
  // Look up tenant in database
  try {
    const pool = getCorePool();
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, slug FROM tenants WHERE slug = ? AND status = ?',
      [slug, 'active']
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return {
      id: rows[0].id,
      slug: rows[0].slug,
      schemaName: `tenant_${rows[0].slug}`,
    };
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }
}

/**
 * Execute a query on a tenant's database
 */
export async function tenantQuery<T extends mysql.RowDataPacket[]>(
  tenantSlug: string,
  sql: string,
  params?: any[]
): Promise<T> {
  const pool = await getTenantPool(tenantSlug);
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

/**
 * Execute a query on the core database
 */
export async function coreQuery<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: any[]
): Promise<T> {
  const pool = getCorePool();
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

/**
 * Transaction wrapper for tenant database
 */
export async function withTenantTransaction<T>(
  tenantSlug: string,
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const pool = await getTenantPool(tenantSlug);
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Transaction wrapper for core database
 */
export async function withCoreTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getCorePool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Cleanup all connection pools
 */
export async function closeAllPools(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  
  if (corePool) {
    closePromises.push(corePool.end());
    corePool = null;
  }
  
  for (const [slug, pool] of tenantPools) {
    closePromises.push(pool.end());
    tenantPools.delete(slug);
  }
  
  await Promise.all(closePromises);
  console.log('All database pools closed');
}
