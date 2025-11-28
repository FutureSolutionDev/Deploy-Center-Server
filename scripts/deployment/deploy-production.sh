#!/bin/bash

###############################################################################
# Deploy Center - Production Deployment Script
# Description: Deploy to production using PM2
# Usage: bash scripts/deployment/deploy-production.sh
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

print_header "Deploy Center - Production Deployment"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed"
    print_info "Install PM2: npm install -g pm2"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    print_info "Create .env from .env.example and configure it"
    exit 1
fi

# 1. Backup current deployment
print_header "Creating Backup"
BACKUP_DIR="backups/deploy-center-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r dist "$BACKUP_DIR/" 2>/dev/null || print_warning "No previous build found"
print_success "Backup created at $BACKUP_DIR"

# 2. Pull latest code
print_header "Pulling Latest Code"
git pull origin main
print_success "Code updated"

# 3. Install dependencies
print_header "Installing Dependencies"
npm ci --production
print_success "Dependencies installed"

# 4. Build TypeScript
print_header "Building TypeScript"
npm run build
print_success "Build complete"

# 5. Run database migrations
print_header "Running Database Migrations"
if grep -q "DB_AUTO_MIGRATE=true" .env; then
    print_info "Auto-migrations enabled in .env"
else
    print_warning "Auto-migrations disabled. Run manually if needed."
fi

# 6. Start/Restart with PM2
print_header "Deploying with PM2"

if pm2 list | grep -q "deploy-center"; then
    print_info "Reloading existing PM2 process..."
    pm2 reload deploy-center
    print_success "PM2 process reloaded (zero-downtime)"
else
    print_info "Starting new PM2 process..."
    pm2 start ecosystem.config.js --env production
    pm2 save
    print_success "PM2 process started"
fi

# 7. Health check
print_header "Health Check"
sleep 3  # Wait for server to start

PORT=$(grep PORT .env | cut -d '=' -f2 | tr -d ' ')
PORT=${PORT:-3000}

if curl -f "http://localhost:$PORT/health" &> /dev/null; then
    print_success "Server is healthy ✅"
else
    print_error "Health check failed ❌"
    print_warning "Check logs: pm2 logs deploy-center"
    exit 1
fi

# 8. Show status
print_header "Deployment Complete!"
pm2 list
echo ""
print_info "Useful commands:"
echo "  pm2 logs deploy-center    # View logs"
echo "  pm2 monit                  # Monitor resources"
echo "  pm2 restart deploy-center  # Restart server"
echo "  pm2 stop deploy-center     # Stop server"
echo ""
print_success "Deploy Center is now running in production! 🚀"
