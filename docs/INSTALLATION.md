# Installation Guide - Deploy Center Server

Complete step-by-step installation guide for Deploy Center deployment platform.

## 📋 Table of Contents

- [System Requirements](#system-requirements)
- [Installation Steps](#installation-steps)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [First Run](#first-run)
- [Production Setup](#production-setup)
- [Docker Installation](#docker-installation)
- [Troubleshooting](#troubleshooting)

---
<a id="system-requirements"></a>

## 🖥️ System Requirements

### Minimum Requirements

- **Operating System:** Linux, macOS, or Windows
- **Node.js:** Version 18.0.0 or higher
- **npm:** Version 9.0.0 or higher
- **MariaDB:** Version 10.6 or higher (or MySQL 8.0+)
- **RAM:** 512 MB minimum (2 GB recommended)
- **Disk Space:** 500 MB minimum (2 GB recommended for deployments)
- **Git:** Version 2.0 or higher

### Recommended Requirements

- **Node.js:** Version 22.x
- **MariaDB:** Version 11.14
- **RAM:** 4 GB or more
- **CPU:** 2 cores or more
- **SSD Storage:** For better performance

### Check Your System

```bash
# Check Node.js version
node --version
# Should output: v18.0.0 or higher

# Check npm version
npm --version
# Should output: 9.0.0 or higher

# Check MariaDB version
mysql --version
# Should output: mysql  Ver 15.1 Distrib 10.6 or higher

# Check Git version
git --version
# Should output: git version 2.x.x or higher
```

---

<a id="installation-steps"></a>

## 🚀 Installation Steps

### Step 1: Install Node.js

#### Ubuntu/Debian

```bash
# Install Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### CentOS/RHEL

```bash
# Install Node.js 22.x 
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

#### macOS

```bash
# Using Homebrew
brew install node@22

# Verify installation
node --version
npm --version
```

#### Windows

1. Download installer from [nodejs.org](https://nodejs.org/en/download/)
2. Run the installer
3. Follow the installation wizard
4. Verify installation in Command Prompt:

```cmd
node --version
npm --version
```

### Step 2: Install MariaDB

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install MariaDB
sudo apt install mariadb-server mariadb-client

# Secure installation
sudo mysql_secure_installation

# Start MariaDB service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Verify installation
mysql --version
```

#### CentOS/RHEL

```bash
# Install MariaDB
sudo yum install mariadb-server mariadb

# Start MariaDB service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure installation
sudo mysql_secure_installation

# Verify installation
mysql --version
```

#### macOS

```bash
# Using Homebrew
brew install mariadb

# Start MariaDB service
brew services start mariadb

# Secure installation
mysql_secure_installation

# Verify installation
mysql --version
```

#### Windows

1. Download MariaDB installer from [mariadb.org](https://mariadb.org/download/)
2. Run the installer
3. Set root password during installation
4. Verify installation in Command Prompt:

```cmd
mysql --version
```

### Step 3: Clone Repository

```bash
# Clone the repository
git clone <your-repository-url>

# Navigate to server directory
cd deploy-center/server

# Or if you're already in the project
cd server
```

### Step 4: Install Dependencies

```bash
# Install all npm dependencies
npm install
# Or 
yarn install

# This will install:
# - Express and middleware
# - TypeScript and ts-node
# - Sequelize ORM and MariaDB driver
# - JWT and bcrypt
# - Winston logger
# - And all other dependencies
```

**Expected output:**

```
added 500+ packages in 30s
```

---

<a id="database-setup"></a>

## 🗄️ Database Setup

### Step 1: Access MariaDB

```bash
# Login to MariaDB as root
sudo mysql -u root -p
# Enter your root password when prompted
```

### Step 2: Create Database

```sql
-- Create database with UTF-8 encoding
CREATE DATABASE deploy_center
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Verify database creation
SHOW DATABASES;
```

### Step 3: Create Database User

```sql
-- Create dedicated user for Deploy Center
CREATE USER 'deploy_user'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';

-- Grant all privileges on deploy_center database
GRANT ALL PRIVILEGES ON deploy_center.* TO 'deploy_user'@'localhost';

-- If you need remote access (replace 'your-ip' with actual IP)
CREATE USER 'deploy_user'@'your-ip' IDENTIFIED BY 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON deploy_center.* TO 'deploy_user'@'your-ip';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify user creation
SELECT User, Host FROM mysql.user WHERE User = 'deploy_user';

-- Exit MariaDB
EXIT;
```

### Step 4: Test Database Connection

```bash
# Test connection with new user
mysql -u deploy_user -p deploy_center

# Enter password: YourSecurePassword123!

# If successful, you should see:
# MariaDB [deploy_center]>

# Exit
EXIT;
```

---

<a id="environment-configuration"></a>

## ⚙️ Environment Configuration

### Step 1: Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Open the file for editing
nano .env
# or
vim .env
# or use your preferred text editor
```

### Step 2: Configure Database

Edit `.env` file and update the database section:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=deploy_center
DB_USER=deploy_user
DB_PASSWORD=YourSecurePassword123!
DB_DIALECT=mariadb
```

### Step 3: Configure Server

```env
# Server Configuration
NODE_ENV=development
PORT=3000
```

### Step 4: Generate Secure Secrets

**IMPORTANT:** Never use default secrets in production!

#### Generate JWT Secrets

```bash
# Generate random secret for JWT
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output

# Generate another for refresh token
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy the output
```

Update `.env`:

```env
# JWT Configuration
JWT_SECRET=<paste-first-generated-secret-here>
JWT_EXPIRY=1h
JWT_REFRESH_SECRET=<paste-second-generated-secret-here>
JWT_REFRESH_EXPIRY=7d
```

#### Generate Encryption Key

```bash
# Generate 32-character encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output
```

Update `.env`:

```env
# Encryption Configuration
ENCRYPTION_KEY=<paste-generated-key-here>
```

### Step 5: Configure CORS (Optional)

```env
# CORS Configuration (Separate by comma Between Every Origin)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
```

### Step 6: Configure Paths

```env
# Paths Configuration
DEPLOYMENTS_PATH=./deployments
LOGS_PATH=./logs
```

### Complete `.env` Example

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=deploy_center
DB_USER=deploy_user
DB_PASSWORD=YourSecurePassword123!
DB_DIALECT=mariadb

# JWT
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRY=1h
JWT_REFRESH_SECRET=z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1
JWT_REFRESH_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Paths
DEPLOYMENTS_PATH=./deployments
LOGS_PATH=./logs
```

---

<a id="first-run"></a>

## 🎬 First Run

### Step 1: Build TypeScript

```bash
# Compile TypeScript to JavaScript
npm run build 

# Or 
yarn build

# This creates the 'dist' directory with compiled files
```

**Expected output:**

```mermaid
Successfully compiled TypeScript
```

### Step 2: Start Development Server

```bash
# Start server in development mode with hot reload
npm run dev
# Or 
yarn dev
```

**Expected output:**

```mermaid
╔════════════════════════════════════════════════════════╗
║                                                        ║
║           🚀 Deploy Center Server Started 🚀          ║
║                                                        ║
║  Port:        3000                                     ║
║  Environment: development                              ║
║  API:         http://localhost:3000/api                ║
║  Health:      http://localhost:3000/health             ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

### Step 3: Test Server

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {
#   "Success": true,
#   "Message": "Deploy Center API is running",
#   "Timestamp": "2025-01-26T..."
# }
```

### Step 4: Check Database Tables

```bash
# Login to MariaDB
mysql -u deploy_user -p deploy_center

# List tables (should be auto-created on first run)
SHOW TABLES;

# Expected output:
# +---------------------------+
# | Tables_in_deploy_center   |
# +---------------------------+
# | AuditLogs                 |
# | DeploymentSteps           |
# | Deployments               |
# | Projects                  |
# | Users                     |
# +---------------------------+
```

### Step 5: Create First Admin User

```bash
# Using curl
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "Username": "admin",
    "Email": "admin@example.com",
    "Password": "Admin@12345",
    "Role": "admin"
  }'

# Save the AccessToken from response for next requests
```

**Expected response:**

```json
{
  "Success": true,
  "Message": "User registered successfully",
  "Data": {
    "User": {
      "Id": 1,
      "Username": "admin",
      "Email": "admin@example.com",
      "Role": "admin"
    },
    "Tokens": {
      "AccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "RefreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "Code": 201
}
```

### Step 6: Test Authentication

```bash
# Get user profile (replace YOUR_TOKEN with actual token)
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: User profile data
```

---

<a id="production-setup"></a>

## 🏭 Production Setup

### Step 1: Update Environment

Create `.env.production`:

```env
NODE_ENV=production
PORT=3000
# ... rest of configuration
```

### Step 2: Build for Production

```bash
# Clean previous builds
npm run clean

# Build TypeScript
npm run build
# Or 
yarn build

# Install only production dependencies
npm ci --production
```

### Step 3: Install PM2

```bash
# Install PM2 globally
npm install -g pm2
```

### Step 4: Create PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'deploy-center',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
  }]
};
```

### Step 5: Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions from the output

# Monitor application
pm2 monit

# View logs
pm2 logs deploy-center
```

### Step 6: Setup Nginx Reverse Proxy

Install Nginx:

```bash
sudo apt install nginx  # Ubuntu/Debian
```

Create Nginx configuration `/etc/nginx/sites-available/deploy-center`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeout for long deployments
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/deploy-center /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 7: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Certificates will auto-renew
```

### Step 8: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

### Step 9: Database Backup Setup

Create backup script `/usr/local/bin/backup-deploy-center.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/deploy-center"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="deploy_center"
DB_USER="deploy_user"
DB_PASS="YourSecurePassword123!"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: db_backup_$DATE.sql.gz"
```

Make executable and setup cron:

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-deploy-center.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e

# Add this line:
0 2 * * * /usr/local/bin/backup-deploy-center.sh
```

---

<a id="docker-installation"></a>

## 🐳 Docker Installation

### Step 1: Create Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine

# Install git
RUN apk add --no-cache git

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy app source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
```

### Step 2: Create docker-compose.yml

```yaml
version: '3.8'

services:
  mariadb:
    image: mariadb:10.11
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: deploy_center
      MYSQL_USER: deploy_user
      MYSQL_PASSWORD: deploypassword
    volumes:
      - mariadb_data:/var/lib/mysql
    ports:
      - "3306:3306"
    networks:
      - deploy-network

  app:
    build: .
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DB_HOST: mariadb
      DB_PORT: 3306
      DB_NAME: deploy_center
      DB_USER: deploy_user
      DB_PASSWORD: deploypassword
    depends_on:
      - mariadb
    volumes:
      - ./deployments:/usr/src/app/deployments
      - ./logs:/usr/src/app/logs
    networks:
      - deploy-network

volumes:
  mariadb_data:

networks:
  deploy-network:
    driver: bridge
```

### Step 3: Run with Docker Compose

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

<a id="troubleshooting"></a>

## 🔧 Troubleshooting

### Issue: Database Connection Failed

**Symptom:**

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions:**

```bash
# Check if MariaDB is running
sudo systemctl status mariadb

# Start MariaDB if not running
sudo systemctl start mariadb

# Check MariaDB is listening on port 3306
sudo netstat -tlnp | grep 3306

# Test database credentials
mysql -u deploy_user -p deploy_center

# Check .env file configuration
cat .env | grep DB_
```

### Issue: Port Already in Use

**Symptom:**

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID with actual process ID)
kill -9 PID

# Or change port in .env
PORT=3001
```

### Issue: Permission Denied

**Symptom:**

```
Error: EACCES: permission denied
```

**Solutions:**

```bash
# Fix deployments directory permissions
sudo chown -R $USER:$USER ./deployments
chmod 755 ./deployments

# Fix logs directory permissions
sudo chown -R $USER:$USER ./logs
chmod 755 ./logs
```

### Issue: Module Not Found

**Symptom:**

```
Error: Cannot find module '@Config/AppConfig'
```

**Solutions:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
# Or 
yarn install

# Rebuild TypeScript
npm run build
# Or 
yarn build

# Check tsconfig.json paths configuration
```

### Issue: TypeScript Compilation Errors

**Solutions:**

```bash
# Clean and rebuild
npm run clean
npm run build
# Or 
yarn clean
yarn build

# Check TypeScript version
npx tsc --version

# Reinstall TypeScript
npm install -D typescript@latest
# Or 
yarn add -D typescript@latest
```

### Issue: Webhook Not Working

**Solutions:**

1. Check webhook secret matches between GitHub and project
2. Verify server is accessible from internet (use ngrok for local testing)
3. Check webhook logs in GitHub settings
4. Test webhook endpoint manually
5. Review logs: `tail -f logs/combined-*.log`

### Issue: PM2 Not Starting

**Solutions:**

```bash
# Check PM2 status
pm2 status

# Delete and restart
pm2 delete deploy-center
pm2 start ecosystem.config.js

# Check logs
pm2 logs deploy-center

# Reset PM2
pm2 kill
pm2 start ecosystem.config.js
```

---

<a id="support"></a>

## 📞 Getting Help

If you encounter issues not covered here:

1. **Check Logs:**

   ```bash
   # Application logs
   tail -f logs/combined-*.log
   tail -f logs/error-*.log

   # PM2 logs (if using PM2)
   pm2 logs deploy-center
   ```

2. **Enable Debug Mode:**

   ```env
   NODE_ENV=development
   LOG_LEVEL=debug
   ```

3. **Check GitHub Issues:** Search for similar issues
4. **Create New Issue:** Include logs and configuration (remove sensitive data)

---

<a id="verification-checklist"></a>

## ✅ Verification Checklist

After installation, verify everything is working:

- [ ] Node.js and npm installed (v18+)
- [ ] MariaDB installed and running
- [ ] Database created and user configured
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured with secure secrets
- [ ] Server starts without errors (`npm run dev`)
- [ ] Health endpoint responds (`/health`)
- [ ] Can register user (`POST /api/auth/register`)
- [ ] Can login (`POST /api/auth/login`)
- [ ] Can create project (`POST /api/projects`)
- [ ] Webhook endpoint accessible (`/webhook/test/:projectName`)
- [ ] Logs being written to `logs/` directory
- [ ] PM2 running in production (if applicable)
- [ ] Nginx reverse proxy working (if applicable)
- [ ] SSL certificate installed (if applicable)
- [ ] Firewall configured (if applicable)
- [ ] Database backups configured (if applicable)

---

<a id="installation-complete"></a>

## 🎉 Installation Complete

Your Deploy Center server is now installed and ready to use!

**Next Steps:**

1. Read the [Quick Start Guide](QUICK_START.md)
2. Import the [Postman Collection](POSTMAN_COLLECTION.json)
3. Setup your first project
4. Configure GitHub webhooks
5. Start deploying!

For detailed usage instructions, see [README.md](README.md)
