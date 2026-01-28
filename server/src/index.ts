import { app } from './app.js';
import { config, validateConfig } from './config.js';
import { testConnection } from './services/db.js';
import { initializeCoreDb, closeAllPools } from './services/mariadb.js';

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║        GameTaverns API Server v2.0.0                  ║
  ╚═══════════════════════════════════════════════════════╝
  `);
  
  // Validate config
  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
  }
  
  // Initialize database based on config
  if (config.isMariaDb) {
    // Multi-tenant MariaDB mode
    console.log('Mode: Multi-tenant (MariaDB)');
    try {
      await initializeCoreDb();
    } catch (error) {
      console.error('Failed to connect to MariaDB. Exiting.');
      process.exit(1);
    }
  } else {
    // Legacy PostgreSQL mode
    console.log('Mode: Single-tenant (PostgreSQL)');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to PostgreSQL. Exiting.');
      process.exit(1);
    }
  }
  
  // Start server
  const server = app.listen(config.port, () => {
    console.log(`
  ✓ Server running on port ${config.port}
  ✓ Environment: ${config.nodeEnv}
  ✓ Site: ${config.siteName}
  ✓ Database: ${config.isMariaDb ? 'MariaDB (multi-tenant)' : 'PostgreSQL'}
  
  Features:
    • Play Logs: ${config.features.playLogs ? '✓' : '✗'}
    • Wishlist: ${config.features.wishlist ? '✓' : '✗'}
    • For Sale: ${config.features.forSale ? '✓' : '✗'}
    • Messaging: ${config.features.messaging ? '✓' : '✗'}
    • Ratings: ${config.features.ratings ? '✓' : '✗'}
    • AI (BYOK): ${config.features.ai ? '✓' : '✗'}
    `);
  });
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    server.close(async () => {
      console.log('HTTP server closed');
      
      if (config.isMariaDb) {
        await closeAllPools();
      }
      
      console.log('All connections closed. Exiting.');
      process.exit(0);
    });
    
    // Force close after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(console.error);
