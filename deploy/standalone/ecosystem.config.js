// PM2 Ecosystem Configuration for GameTaverns

module.exports = {
  apps: [
    {
      name: 'gametaverns-api',
      script: 'server/dist/index.js',
      cwd: '/home/gametaverns/web/gametaverns.com/public_html',
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      // Cluster mode for multi-core
      instances: 'max',
      exec_mode: 'cluster',
      
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      
      // Memory limit (restart if exceeded)
      max_memory_restart: '500M',
      
      // Logs
      log_file: '/home/gametaverns/logs/gametaverns-api.log',
      error_file: '/home/gametaverns/logs/gametaverns-api-error.log',
      out_file: '/home/gametaverns/logs/gametaverns-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Watch for changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
