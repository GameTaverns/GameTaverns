import { Request, Response, NextFunction } from 'express';
import { resolveTenant, TenantContext, getTenantPool } from '../services/mariadb.js';
import mysql from 'mysql2/promise';

// Extend Express Request type with tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      tenantPool?: mysql.Pool;
    }
  }
}

/**
 * Middleware to resolve tenant from subdomain or query parameter
 * 
 * For production: extracts from subdomain (tzolak.gametaverns.com)
 * For development: uses ?tenant=tzolak query parameter
 */
export async function tenantMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    let tenant: TenantContext | null = null;
    
    // In development, allow tenant override via query param
    const tenantParam = req.query.tenant as string | undefined;
    const hostname = req.hostname || req.headers.host?.split(':')[0] || '';
    
    if (tenantParam) {
      // Development mode: use query parameter
      tenant = await resolveTenant(`${tenantParam}.gametaverns.com`);
    } else {
      // Production mode: extract from hostname
      tenant = await resolveTenant(hostname);
    }
    
    if (tenant) {
      req.tenant = tenant;
      // Pre-fetch the tenant pool for convenience
      req.tenantPool = await getTenantPool(tenant.slug);
    }
    
    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    next(error);
  }
}

/**
 * Middleware that REQUIRES a tenant context
 * Returns 404 if no tenant found
 */
export function requireTenant(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  if (!req.tenant) {
    res.status(404).json({ 
      error: 'Library not found',
      message: 'This library does not exist or has been deactivated.'
    });
    return;
  }
  next();
}

/**
 * Middleware that ensures we're on the main platform (not a tenant subdomain)
 * Used for platform-level routes like signup, login, admin
 */
export function requirePlatform(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  if (req.tenant) {
    res.status(400).json({ 
      error: 'Invalid request',
      message: 'This action can only be performed on the main platform.'
    });
    return;
  }
  next();
}

/**
 * Get tenant info for the current request
 */
export function getTenantInfo(req: Request): TenantContext | null {
  return req.tenant || null;
}

/**
 * Check if request is from a tenant subdomain
 */
export function isTenantRequest(req: Request): boolean {
  return !!req.tenant;
}
