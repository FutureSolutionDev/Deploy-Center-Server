#!/bin/bash

###############################################################################
# Deploy Center - Log Cleanup Script
# Description: Remove old log files
# Usage: bash scripts/maintenance/cleanup-logs.sh [days]
# Example: bash scripts/maintenance/cleanup-logs.sh 30
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

# Default retention period (days)
RETENTION_DAYS=${1:-30}

# Log directory
LOG_DIR="logs"

if [ ! -d "$LOG_DIR" ]; then
    print_warning "Log directory not found: $LOG_DIR"
    exit 0
fi

print_info "Cleaning up logs older than $RETENTION_DAYS days..."

# Count files before cleanup
BEFORE_COUNT=$(find "$LOG_DIR" -type f -name "*.log" | wc -l)
BEFORE_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)

# Remove old log files
find "$LOG_DIR" -type f -name "*.log" -mtime +$RETENTION_DAYS -delete

# Count files after cleanup
AFTER_COUNT=$(find "$LOG_DIR" -type f -name "*.log" | wc -l)
AFTER_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)

# Calculate removed files
REMOVED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))

print_success "Cleanup complete!"
print_info "Files before: $BEFORE_COUNT ($BEFORE_SIZE)"
print_info "Files after: $AFTER_COUNT ($AFTER_SIZE)"
print_info "Removed: $REMOVED_COUNT log files"

# Compress remaining old logs (older than 7 days, not already compressed)
print_info "Compressing old logs..."
find "$LOG_DIR" -type f -name "*.log" -mtime +7 ! -name "*.gz" -exec gzip {} \;
print_success "Old logs compressed"
