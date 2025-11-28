#!/bin/bash

###############################################################################
# Deploy Center - Installation Script
# Description: Automated setup for Deploy Center Server
# Usage: bash scripts/setup/install.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should NOT be run as root"
   exit 1
fi

print_header "Deploy Center Installation"

# 1. Check prerequisites
print_header "Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        print_success "Node.js version $NODE_VERSION (Required: >= 18.0.0)"
    else
        print_error "Node.js version $NODE_VERSION is too old. Required: >= 18.0.0"
        exit 1
    fi
else
    print_error "Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm version $NPM_VERSION"
else
    print_error "npm is not installed"
    exit 1
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d ' ' -f 3)
    print_success "Git version $GIT_VERSION"
else
    print_error "Git is not installed"
    exit 1
fi

# Check MariaDB/MySQL
if command -v mysql &> /dev/null; then
    MYSQL_VERSION=$(mysql --version | awk '{print $5}' | cut -d ',' -f 1)
    print_success "MySQL/MariaDB version $MYSQL_VERSION"
else
    print_warning "MySQL/MariaDB client not found. Make sure database is accessible."
fi

# 2. Install dependencies
print_header "Installing Dependencies"
npm install
print_success "Dependencies installed successfully"

# 3. Setup environment file
print_header "Setting up Environment"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success ".env file created from .env.example"
        print_warning "Please edit .env file with your configuration"
    else
        print_error ".env.example not found"
        exit 1
    fi
else
    print_info ".env file already exists"
fi

# 4. Generate secrets
print_header "Generating Secrets"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

print_info "Generated secrets (add to .env file):"
echo -e "${YELLOW}JWT_SECRET=$JWT_SECRET${NC}"
echo -e "${YELLOW}JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET${NC}"
echo -e "${YELLOW}ENCRYPTION_KEY=$ENCRYPTION_KEY${NC}"

# 5. Database setup prompt
print_header "Database Setup"
print_info "Please make sure you have created the database and user:"
echo ""
echo "  CREATE DATABASE deploy_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "  CREATE USER 'deploy_user'@'localhost' IDENTIFIED BY 'your_password';"
echo "  GRANT ALL PRIVILEGES ON deploy_center.* TO 'deploy_user'@'localhost';"
echo "  FLUSH PRIVILEGES;"
echo ""
read -p "Have you created the database? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Please create the database first and run this script again"
    exit 1
fi

# 6. Build TypeScript
print_header "Building TypeScript"
npm run build
print_success "TypeScript compiled successfully"

# 7. Create required directories
print_header "Creating Required Directories"
mkdir -p logs deployments
print_success "Directories created"

# 8. Final instructions
print_header "Installation Complete!"
echo ""
print_success "Deploy Center has been installed successfully!"
echo ""
print_info "Next steps:"
echo "  1. Edit .env file with your database credentials"
echo "  2. Add the generated secrets to .env file"
echo "  3. Run 'npm run dev' to start development server"
echo "  4. Run 'npm start' to start production server"
echo ""
print_info "For production deployment with PM2:"
echo "  1. Install PM2: npm install -g pm2"
echo "  2. Start: pm2 start ecosystem.config.js --env production"
echo "  3. Save: pm2 save"
echo "  4. Startup: pm2 startup"
echo ""
print_success "Happy deploying! 🚀"
