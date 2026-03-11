module.exports = {
  apps: [
    {
      name: 'deploy-center',
      cwd: '/home/Work/DeployCenter',
      script: 'dist/index.js',

      node_args: '-r ./tsconfig-paths-bootstrap.js',

      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,

      max_memory_restart: '1G',

      env: {
        NODE_ENV: 'development',
        PORT: 9090,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 9090,
      },

      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],

  deploy: {
    production: {
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
