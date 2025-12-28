# GitHub Private Repositories Setup Guide

This guide explains how to connect Deploy Center with GitHub private repositories.

## Method 1: SSH Keys (Recommended) 🔐

### Step 1: Generate SSH Key on Server

```bash
# Generate new SSH key (replace with your email)
ssh-keygen -t ed25519 -C "deploy-center@yourserver.com" -f ~/.ssh/deploy_center_key

# Or use RSA (if ed25519 not supported)
ssh-keygen -t rsa -b 4096 -C "deploy-center@yourserver.com" -f ~/.ssh/deploy_center_key

# Start SSH agent
eval "$(ssh-agent -s)"

# Add the key to SSH agent
ssh-add ~/.ssh/deploy_center_key
```

### Step 2: Add Public Key to GitHub

```bash
# Display the public key
cat ~/.ssh/deploy_center_key.pub
```

**Copy the output, then:**

#### Option A: Deploy Keys (Per Repository)
1. Go to your GitHub repository
2. Settings → Deploy keys → Add deploy key
3. Title: `Deploy Center Server`
4. Key: Paste the public key
5. ✅ Check "Allow write access" (if needed for git operations)
6. Click "Add key"

#### Option B: SSH Keys (Account Level - All Repos)
1. Go to GitHub Settings (your profile)
2. SSH and GPG keys → New SSH key
3. Title: `Deploy Center Server`
4. Key type: `Authentication Key`
5. Key: Paste the public key
6. Click "Add SSH key"

### Step 3: Configure SSH Config File

```bash
# Create/edit SSH config
nano ~/.ssh/config
```

Add the following:

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/deploy_center_key
    IdentitiesOnly yes
    StrictHostKeyChecking no
```

### Step 4: Test SSH Connection

```bash
# Test connection
ssh -T git@github.com

# Expected output:
# Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

### Step 5: Update Repository URLs

When creating projects in Deploy Center, use SSH format:

```
✅ SSH Format (Recommended):
git@github.com:username/repo-name.git

❌ HTTPS Format (Won't work for private repos without PAT):
https://github.com/username/repo-name.git
```

---

## Method 2: Personal Access Token (PAT) 🔑

### Step 1: Generate PAT on GitHub

1. Go to GitHub Settings → Developer settings
2. Personal access tokens → Tokens (classic) → Generate new token
3. Give it a name: `Deploy Center`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### Step 2: Use PAT in Repository URL

When creating projects, use this format:

```
https://YOUR_TOKEN@github.com/username/repo-name.git
```

**Example:**
```
https://ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx@github.com/mycompany/private-app.git
```

### Step 3: Store PAT Securely (Recommended)

Instead of putting the token directly in the URL, use Git credential helper:

```bash
# Configure git to cache credentials
git config --global credential.helper store

# Or use credential manager (Windows)
git config --global credential.helper wincred

# Or use cache with timeout (Linux)
git config --global credential.helper 'cache --timeout=3600'
```

Then use HTTPS URL normally:
```
https://github.com/username/repo-name.git
```

Git will prompt for username/password once:
- Username: `your-github-username`
- Password: `your-personal-access-token`

---

## Method 3: GitHub App (Advanced) 🤖

For organizations with multiple repositories:

### Step 1: Create GitHub App

1. GitHub Settings → Developer settings → GitHub Apps → New GitHub App
2. Fill in:
   - Name: `Deploy Center`
   - Homepage URL: `http://your-server.com`
   - Webhook URL: `http://your-server.com/api/webhooks/github`
   - Webhook secret: (same as in config)
3. Permissions:
   - Repository permissions:
     - Contents: Read & write
     - Webhooks: Read & write
4. Create app
5. Generate private key and download it

### Step 2: Install App on Repositories

1. Install app on your organization/account
2. Select repositories to give access to

### Step 3: Authenticate Using App

This requires modifying the server code to use GitHub App authentication. (Not currently implemented)

---

## Troubleshooting

### SSH Connection Issues

```bash
# Debug SSH connection
ssh -vT git@github.com

# Test git clone
git clone git@github.com:username/test-repo.git
```

### Common Issues:

1. **"Permission denied (publickey)"**
   - SSH key not added to GitHub
   - SSH key not added to ssh-agent
   - Wrong key in SSH config

2. **"Host key verification failed"**
   - Add GitHub to known_hosts:
   ```bash
   ssh-keyscan github.com >> ~/.ssh/known_hosts
   ```

3. **Clone fails with "Repository not found"**
   - Check repository URL format
   - Verify you have access to the repository
   - For private repos, ensure deploy key or SSH key is added

4. **Authentication failed (HTTPS)**
   - PAT expired or invalid
   - PAT doesn't have `repo` scope
   - Username/token format incorrect in URL

---

## Security Best Practices

### SSH Keys:
- ✅ Use separate SSH key for Deploy Center (don't reuse personal key)
- ✅ Use Deploy Keys (per-repo) instead of account-level keys when possible
- ✅ Don't add write access unless necessary
- ✅ Rotate keys periodically

### Personal Access Tokens:
- ✅ Use fine-grained tokens (new GitHub feature)
- ✅ Set expiration date
- ✅ Give minimal required permissions
- ✅ Store tokens in environment variables, not in code
- ✅ Rotate tokens regularly

### Environment Variables:
```bash
# Add to server .env file
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Or for multiple tokens (per project)
PROJECT_1_GITHUB_TOKEN=ghp_xxx
PROJECT_2_GITHUB_TOKEN=ghp_yyy
```

---

## Testing the Setup

### 1. Test Manual Clone

```bash
# SSH
git clone git@github.com:username/private-repo.git /tmp/test-clone

# HTTPS with PAT
git clone https://YOUR_TOKEN@github.com/username/private-repo.git /tmp/test-clone

# Clean up
rm -rf /tmp/test-clone
```

### 2. Create Test Project in Deploy Center

1. Create a new project
2. Use your private repository URL (SSH or HTTPS)
3. Trigger a manual deployment
4. Check logs for clone success

---

## Recommended Setup for Production

```bash
# 1. Generate dedicated SSH key
ssh-keygen -t ed25519 -C "deploy-center-prod@company.com" -f ~/.ssh/deploy_center_prod

# 2. Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/deploy_center_prod

# 3. Configure SSH
cat >> ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/deploy_center_prod
    IdentitiesOnly yes
    StrictHostKeyChecking no
EOF

# 4. Test connection
ssh -T git@github.com

# 5. Add public key to GitHub as Deploy Key (for each repo)
cat ~/.ssh/deploy_center_prod.pub
```

---

## Multiple GitHub Accounts

If you need to use different SSH keys for different organizations:

```bash
# ~/.ssh/config
Host github-company1
    HostName github.com
    User git
    IdentityFile ~/.ssh/company1_key
    IdentitiesOnly yes

Host github-company2
    HostName github.com
    User git
    IdentityFile ~/.ssh/company2_key
    IdentitiesOnly yes
```

Then use custom host in repository URL:
```
git@github-company1:organization/repo.git
git@github-company2:organization/repo.git
```

---

## Next Steps

After setting up authentication:

1. ✅ Test cloning a private repository manually
2. ✅ Create a project in Deploy Center with the private repo URL
3. ✅ Trigger a test deployment
4. ✅ Verify logs show successful clone operation
5. ✅ Set up webhook for automatic deployments (optional)

For webhook setup, see [WEBHOOKS_SETUP.md](./WEBHOOKS_SETUP.md)
