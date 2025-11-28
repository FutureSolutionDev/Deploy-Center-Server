#!/bin/bash

###############################################################################
# Deploy Center - Database Setup Script
# Description: Create database and user for Deploy Center
# Usage: bash scripts/database/setup-database.sh
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

print_header "Deploy Center - Database Setup"

# Default values
DB_NAME="deploy_center"
DB_USER="deploy_user"
DB_HOST="localhost"

# Prompt for database details
read -p "Database name [$DB_NAME]: " input_db_name
DB_NAME="${input_db_name:-$DB_NAME}"

read -p "Database user [$DB_USER]: " input_db_user
DB_USER="${input_db_user:-$DB_USER}"

read -p "Database host [$DB_HOST]: " input_db_host
DB_HOST="${input_db_host:-$DB_HOST}"

read -sp "Database password for $DB_USER: " DB_PASSWORD
echo

if [ -z "$DB_PASSWORD" ]; then
    print_error "Password cannot be empty"
    exit 1
fi

read -sp "MySQL root password: " ROOT_PASSWORD
echo

if [ -z "$ROOT_PASSWORD" ]; then
    print_error "Root password cannot be empty"
    exit 1
fi

print_header "Creating Database"

# Create database and user
mysql -h "$DB_HOST" -u root -p"$ROOT_PASSWORD" <<EOF
-- Create database
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS '$DB_USER'@'$DB_HOST' IDENTIFIED BY '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'$DB_HOST';

-- Flush privileges
FLUSH PRIVILEGES;

-- Show databases
SHOW DATABASES LIKE '$DB_NAME';
EOF

if [ $? -eq 0 ]; then
    print_success "Database created successfully"
    print_success "User '$DB_USER' created with full privileges on '$DB_NAME'"
    echo ""
    print_info "Add these to your .env file:"
    echo ""
    echo "DB_HOST=$DB_HOST"
    echo "DB_PORT=3306"
    echo "DB_NAME=$DB_NAME"
    echo "DB_USER=$DB_USER"
    echo "DB_PASSWORD=$DB_PASSWORD"
    echo "DB_DIALECT=mariadb"
    echo "DB_AUTO_MIGRATE=true"
    echo ""
else
    print_error "Failed to create database"
    exit 1
fi

print_success "Database setup complete! 🎉"
