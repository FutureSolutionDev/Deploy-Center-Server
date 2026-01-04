# Scripts

Automation scripts for Deploy Center setup, deployment, and maintenance.

## 📁 Directory Structure

```tree
scripts/
├── setup/              # Initial setup scripts
├── deployment/         # Production deployment scripts
├── database/           # Database management scripts
├── maintenance/        # Backup and cleanup scripts
└── README.md          # This file
```

---

## 🚀 Setup Scripts

Scripts for initial installation and configuration.

### `setup/install.sh`

**Complete installation script for Deploy Center.**

**What it does:**

- ✅ Checks prerequisites (Node.js, npm, Git, MySQL/MariaDB)
- ✅ Installs npm dependencies
- ✅ Creates `.env` from `.env.example`
- ✅ Generates secure secrets (JWT, encryption keys)
- ✅ Builds TypeScript
- ✅ Creates required directories

**Usage:**

```bash
bash scripts/setup/install.sh
```

**Output:**

```
═══════════════════════════════════════════════════════════
  Deploy Center Installation
═══════════════════════════════════════════════════════════

✓ Node.js version 18.17.0 (Required: >= 18.0.0)
✓ npm version 9.6.7
✓ Git version 2.41.0
✓ Dependencies installed successfully
✓ .env file created from .env.example
ℹ Generated secrets (add to .env file):
  JWT_SECRET=abc123...
  JWT_REFRESH_SECRET=def456...
  ENCRYPTION_KEY=ghi789...
✓ TypeScript compiled successfully
✓ Deploy Center has been installed successfully!
```

---

## 🗄️ Database Scripts

Scripts for database setup and management.

### `database/setup-database.sh`

**Create database and user for Deploy Center.**

**What it does:**

- ✅ Creates database with UTF-8 encoding
- ✅ Creates database user
- ✅ Grants privileges
- ✅ Provides .env configuration

**Usage:**

```bash
bash scripts/database/setup-database.sh
```

**Interactive prompts:**

```
Database name [deploy_center]:
Database user [deploy_user]:
Database host [localhost]:
Database password for deploy_user: ********
MySQL root password: ********
```

**Output:**

```
✓ Database created successfully
✓ User 'deploy_user' created with full privileges on 'deploy_center'

Add these to your .env file:
DB_HOST=localhost
DB_PORT=3306
DB_NAME=deploy_center
DB_USER=deploy_user
DB_PASSWORD=********
DB_DIALECT=mariadb
DB_AUTO_MIGRATE=true
```

---

## 🚀 Deployment Scripts

Scripts for production deployment with PM2.

### `deployment/deploy-production.sh`

**Deploy to production with zero-downtime.**

**What it does:**

- ✅ Creates backup of current deployment
- ✅ Pulls latest code from Git
- ✅ Installs production dependencies
- ✅ Builds TypeScript
- ✅ Runs database migrations (if enabled)
- ✅ Starts/reloads PM2 process
- ✅ Performs health check
- ✅ Shows deployment status

**Usage:**

```bash
bash scripts/deployment/deploy-production.sh
```

**Output:**

```ascii
═══════════════════════════════════════════════════════════
  Deploy Center - Production Deployment
═══════════════════════════════════════════════════════════

✓ Backup created at backups/deploy-center-20250128_143022
✓ Code updated
✓ Dependencies installed
✓ Build complete
✓ PM2 process reloaded (zero-downtime)
✓ Server is healthy ✅

┌─────────────┬────┬─────────┬──────────┬────────┐
│ Name        │ id │ mode    │ status   │ ↺      │
├─────────────┼────┼─────────┼──────────┼────────┤
│ deploy-c... │ 0  │ fork    │ online   │ 15     │
└─────────────┴────┴─────────┴──────────┴────────┘

✓ Deploy Center is now running in production! 🚀
```

**Prerequisites:**

- PM2 must be installed: `npm install -g pm2`
- `.env` file must exist and be configured
- Git repository must be initialized

---

## 🔧 Maintenance Scripts

Scripts for backup, cleanup, and maintenance.

### `maintenance/backup-database.sh`

**Backup MariaDB/MySQL database.**

**What it does:**

- ✅ Creates SQL dump of database
- ✅ Compresses backup with gzip
- ✅ Stores in `backups/database/` directory
- ✅ Keeps last 10 backups (removes older ones)

**Usage:**

```bash
bash scripts/maintenance/backup-database.sh
```

**Output:**

```
ℹ Starting database backup...
✓ Database backed up successfully
ℹ File: backups/database/deploy_center_20250128_143022.sql.gz
ℹ Size: 2.3M
ℹ Removed old backups (keeping last 10)
✓ Backup complete! 🎉
```

**Schedule with cron:**

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/deploy-center/server && bash scripts/maintenance/backup-database.sh
```

---

### `maintenance/cleanup-logs.sh`

**Remove old log files.**

**What it does:**

- ✅ Removes logs older than N days (default: 30)
- ✅ Compresses logs older than 7 days
- ✅ Shows disk space savings

**Usage:**

```bash
# Remove logs older than 30 days (default)
bash scripts/maintenance/cleanup-logs.sh

# Remove logs older than 7 days
bash scripts/maintenance/cleanup-logs.sh 7

# Remove logs older than 90 days
bash scripts/maintenance/cleanup-logs.sh 90
```

**Output:**

```
ℹ Cleaning up logs older than 30 days...
✓ Cleanup complete!
ℹ Files before: 245 (1.2G)
ℹ Files after: 89 (456M)
ℹ Removed: 156 log files
ℹ Compressing old logs...
✓ Old logs compressed
```

**Schedule with cron:**

```bash
# Weekly cleanup on Sunday at 3 AM
0 3 * * 0 cd /path/to/deploy-center/server && bash scripts/maintenance/cleanup-logs.sh
```

---

## 🔐 Making Scripts Executable

Before running scripts, make them executable:

```bash
# Make all scripts executable
chmod +x scripts/**/*.sh

# Or individual script
chmod +x scripts/setup/install.sh
```

---

## ⏰ Automation with Cron

### Recommended Cron Schedule

```bash
# Edit crontab
crontab -e

# Add these lines:

# Daily database backup at 2 AM
0 2 * * * cd /var/www/deploy-center/server && bash scripts/maintenance/backup-database.sh >> logs/backup.log 2>&1

# Weekly log cleanup on Sunday at 3 AM
0 3 * * 0 cd /var/www/deploy-center/server && bash scripts/maintenance/cleanup-logs.sh 30 >> logs/cleanup.log 2>&1

# Monthly full system backup (first day of month at 1 AM)
0 1 1 * * cd /var/www/deploy-center/server && tar -czf backups/full-backup-$(date +\%Y\%m\%d).tar.gz . >> logs/full-backup.log 2>&1
```

---

## 📋 Checklist

### Initial Setup ✅

- [ ] Run `scripts/setup/install.sh`
- [ ] Run `scripts/database/setup-database.sh`
- [ ] Edit `.env` with generated secrets
- [ ] Run `npm run dev` to test

### Production Deployment ✅

- [ ] Configure environment variables in `.env`
- [ ] Install PM2: `npm install -g pm2`
- [ ] Run `scripts/deployment/deploy-production.sh`
- [ ] Setup SSL with Let's Encrypt
- [ ] Configure Nginx reverse proxy
- [ ] Setup firewall rules

### Maintenance ✅

- [ ] Schedule database backups (cron)
- [ ] Schedule log cleanup (cron)
- [ ] Monitor disk space
- [ ] Review PM2 logs weekly

---

## 🆘 Troubleshooting

### Script fails with "Permission denied"

```bash
chmod +x scripts/path/to/script.sh
```

### Database backup fails

- Check database credentials in `.env`
- Ensure `mysqldump` is installed
- Verify database user has SELECT privilege

### PM2 deployment fails

- Check PM2 is installed: `pm2 --version`
- Verify `ecosystem.config.js` exists
- Check `.env` file is present
- Review PM2 logs: `pm2 logs deploy-center`

---

## 🤝 Contributing

Want to add a useful script?

1. Create script in appropriate directory
2. Add documentation to this README
3. Make it executable
4. Test thoroughly
5. Submit PR

---

**Happy automating! 🤖**
