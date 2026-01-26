import { app } from './app.js';
import { config, validateConfig } from './config.js';
import { testConnection } from './services/db.js';

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║           Game Haven API Server v2.0.0                ║
  ╚═══════════════════════════════════════════════════════╝
  `);
  
  // Validate config
  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
  }
  
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  
  // Start server
  app.listen(config.port, () => {
    console.log(`
  ✓ Server running on port ${config.port}
  ✓ Environment: ${config.nodeEnv}
  ✓ Site: ${config.siteName}
  
  Features:
    • Play Logs: ${config.features.playLogs ? '✓' : '✗'}
    • Wishlist: ${config.features.wishlist ? '✓' : '✗'}
    • For Sale: ${config.features.forSale ? '✓' : '✗'}
    • Messaging: ${config.features.messaging ? '✓' : '✗'}
    • Ratings: ${config.features.ratings ? '✓' : '✗'}
    • AI (BYOK): ${config.features.ai ? '✓' : '✗'}
    `);
  });
}

main().catch(console.error);
