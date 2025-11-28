#!/bin/bash

###############################################################################
# Deploy Center - Database Backup Script
# Description: Backup MariaDB/MySQL database
# Usage: bash scripts/maintenance/backup-database.sh
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
else
    print_error ".env file not found"
    exit 1
fi

# Create backup directory
BACKUP_DIR="backups/database"
mkdir -p "$BACKUP_DIR"

# Backup filename
BACKUP_FILE="$BACKUP_DIR/deploy_center_$(date +%Y%m%d_%H%M%S).sql"

print_info "Starting database backup..."

# Create backup
mysqldump -h "${DB_HOST:-localhost}" \
          -P "${DB_PORT:-3306}" \
          -u "$DB_USER" \
          -p"$DB_PASSWORD" \
          "$DB_NAME" \
          --single-transaction \
          --routines \
          --triggers \
          --events \
          > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

# Get file size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

print_success "Database backed up successfully"
print_info "File: $BACKUP_FILE"
print_info "Size: $BACKUP_SIZE"

# Cleanup old backups (keep last 10)
OLD_BACKUPS=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +11)
if [ ! -z "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | xargs rm -f
    print_info "Removed old backups (keeping last 10)"
fi

print_success "Backup complete! 🎉"
