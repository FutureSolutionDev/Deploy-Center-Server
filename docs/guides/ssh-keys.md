# SSH Key Management - Working with Private Repositories

This guide explains how to use SSH key authentication in Deploy Center for accessing private Git repositories securely.

## Table of Contents

1. [Overview](#overview)
2. [Security Architecture](#security-architecture)
3. [Generating SSH Keys](#generating-ssh-keys)
4. [Adding Keys to Git Platforms](#adding-keys-to-git-platforms)
5. [Key Rotation](#key-rotation)
6. [Troubleshooting](#troubleshooting)

---

## Overview

Deploy Center supports deploying from private Git repositories using SSH key authentication. This is more secure than using passwords and is required for private repositories on GitHub, GitLab, and Bitbucket.

### Why SSH Keys?

**Benefits:**

- ✅ No password storage needed
- ✅ More secure than HTTPS with credentials
- ✅ Automated access without user intervention
- ✅ Can be revoked independently
- ✅ Audit trail for key usage

**When to use:**

- Private repositories
- Organizations requiring SSH-only access
- Enhanced security requirements
- Automated CI/CD pipelines

---

## Security Architecture

Deploy Center implements a **zero-trust** approach to SSH key management:

### Encryption at Rest

**Storage:**

- Private keys encrypted with **AES-256-GCM** before storing in database
- Encryption uses the `ENCRYPTION_KEY` from your `.env` file
- Public keys stored in plain text (safe to expose)

**Encryption Details:**

- Algorithm: AES-256-GCM (Galois/Counter Mode)
- Key derivation: PBKDF2 with 100,000 iterations
- Unique IV (Initialization Vector) per encryption
- Authentication tag for integrity verification

### Zero-Trust Runtime Usage

**Temporary Key Files:**

1. Private key **never** stored permanently on filesystem
2. Decrypted **in-memory** only during deployment
3. Temporary key file created with strict permissions (0600)
4. File deleted immediately after Git operation
5. Automatic cleanup on process exit or crash

**Security Flow:**

```
┌─────────────────────┐
│ Encrypted Database  │
│  (AES-256-GCM)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Decrypt in Memory   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Temp File (0600)   │  ← Only during deployment
│ /tmp/deploy-ssh-*   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Git Clone/Pull     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Secure Delete      │  ← 3-pass overwrite
│  (DoD 5220.22-M)    │
└─────────────────────┘
```

### Secure Deletion

When temporary key files are deleted, Deploy Center uses a **3-pass secure deletion**:

1. **Pass 1**: Overwrite with random data
2. **Pass 2**: Overwrite with zeros
3. **Pass 3**: Overwrite with ones
4. **Final**: Delete file

This prevents forensic recovery of key material from disk.

### Periodic Cleanup

A background process runs every 60 seconds to:

- Find orphaned key files (older than 5 minutes)
- Securely delete abandoned keys
- Log cleanup operations
- Handle crashed deployment cleanup

---

## Generating SSH Keys

### Step 1: Navigate to Project

1. Open your project in Deploy Center
2. Go to project details page
3. Scroll to "SSH Key Management" section

### Step 2: Generate Key

Click **"Generate SSH Key"** button.

**Key Type Options:**

#### ED25519 (Recommended)

- Modern, fast, and secure
- Smaller key size (256-bit)
- Better performance
- Supported by GitHub, GitLab, Bitbucket

**Select this unless:**

- You have legacy systems requiring RSA
- Your Git platform doesn't support ED25519

#### RSA

- Traditional algorithm
- Larger key size (2048-bit or 4096-bit)
- Widely compatible
- Slower than ED25519

**Select this if:**

- Required by your organization
- Compatibility with older systems needed

### Step 3: Copy Public Key

After generation, Deploy Center displays:

```
Public Key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAbCdEf... deploy-center
Fingerprint: SHA256:abc123def456...
Key Type: ED25519
Created: 2026-01-04 11:30:00
```

**Copy** the public key to add to your Git platform.

---

## Adding Keys to Git Platforms

The public key must be added to your Git platform as a **Deploy Key**.

### GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Deploy keys**
3. Click **Add deploy key**
4. Fill in:
   - **Title**: `Deploy Center - [Project Name]`
   - **Key**: Paste the public key
   - **Allow write access**: ❌ Leave unchecked (read-only is safer)
5. Click **Add key**

**Result:** GitHub shows the key as active.

### GitLab

1. Go to your repository on GitLab
2. Navigate to **Settings** → **Repository** → **Deploy Keys**
3. Click **Add key**
4. Fill in:
   - **Title**: `Deploy Center - [Project Name]`
   - **Key**: Paste the public key
   - **Expires at**: Optional (set expiration if required)
   - **Grant write permissions**: ❌ Leave unchecked
5. Click **Add key**

### Bitbucket

1. Go to your repository on Bitbucket
2. Navigate to **Repository settings** → **Access keys**
3. Click **Add key**
4. Fill in:
   - **Label**: `Deploy Center - [Project Name]`
   - **Key**: Paste the public key
5. Click **Add key**

### Custom Git Server

For self-hosted Git servers:

1. SSH into your Git server
2. Add the public key to `~/.ssh/authorized_keys`:

   ```bash
   echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..." >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

---

## Using SSH Keys

### Repository URL Format

Once the SSH key is added, update your project's repository URL to use SSH format:

**HTTPS (won't use SSH key):**

```
https://github.com/username/repository.git
```

**SSH (uses SSH key):**

```
git@github.com:username/repository.git
```

**How to change:**

1. Go to project details
2. Click **Edit Project**
3. Update **Repository URL** to SSH format
4. Save changes

### Testing the Connection

Deploy Center automatically tests the SSH connection during the first deployment:

**Success:**

```
✅ Git clone successful using SSH key
```

**Failure:**

```
❌ Permission denied (publickey)
```

If you see a failure, check:

- Public key added to Git platform correctly
- Repository URL is in SSH format
- Key hasn't been revoked
- Git platform user has repository access

---

## Key Rotation

Regularly rotating SSH keys is a security best practice.

### When to Rotate

**Recommended:**

- Every 90 days for production
- After team member leaves
- If key may have been compromised
- During security audits

**Required:**

- If private key leaked
- If encryption key changed
- If key suspected to be compromised

### How to Rotate

#### Step 1: Regenerate Key

1. Go to project details
2. In "SSH Key Management" section
3. Click **"Regenerate SSH Key"**
4. Select key type (ED25519 or RSA)
5. Confirm regeneration

**⚠️ Warning:** Old private key is immediately deleted and cannot be recovered.

#### Step 2: Update Git Platform

1. Copy the new public key
2. Go to your Git platform (GitHub/GitLab/etc.)
3. **Delete** the old deploy key
4. **Add** the new deploy key (see [Adding Keys](#adding-keys-to-git-platforms))

#### Step 3: Test Deployment

1. Trigger a manual deployment
2. Monitor logs for SSH connection
3. Verify successful clone/pull

### Rotation History

Deploy Center tracks key rotation:

```
Created: 2025-12-01 10:00:00
Last Rotated: 2026-01-04 11:30:00
Rotation Count: 2
```

---

## Deleting SSH Keys

If you no longer need SSH authentication:

### Step 1: Delete from Deploy Center

1. Go to project details
2. In "SSH Key Management" section
3. Click **"Delete SSH Key"**
4. Confirm deletion

**This will:**

- Delete encrypted private key from database
- Remove public key reference
- Disable SSH authentication
- Require switching back to HTTPS URL

### Step 2: Delete from Git Platform

1. Go to your Git platform
2. Navigate to Deploy Keys section
3. Delete the corresponding key

**Why both?**

- Deploy Center can't access your Git platform
- Unused keys should be removed from Git platform for security

---

## Troubleshooting

### "Permission denied (publickey)" Error

**Cause:** Git server rejects SSH connection.

**Solutions:**

1. **Verify public key is added to Git platform:**
   - Check GitHub/GitLab Deploy Keys section
   - Ensure key matches exactly (no extra spaces)

2. **Verify repository URL uses SSH format:**
   - Should be `git@github.com:user/repo.git`
   - Not `https://github.com/user/repo.git`

3. **Regenerate SSH key:**
   - Old key may be corrupted
   - Follow [Key Rotation](#key-rotation) steps

4. **Check Git platform permissions:**
   - User must have read access to repository
   - Organization policies may block deploy keys

### "Failed to decrypt SSH key" Error

**Cause:** Encryption key mismatch.

**Solutions:**

1. **Check ENCRYPTION_KEY in .env:**

   ```bash
   # Verify key exists and is 64 hex characters
   echo $ENCRYPTION_KEY
   ```

2. **If ENCRYPTION_KEY changed:**
   - All existing SSH keys are now unreadable
   - Must regenerate all SSH keys
   - Update Git platforms with new public keys

### "SSH key file not found" Error

**Cause:** Temporary key file was deleted prematurely.

**Solutions:**

1. **Retry deployment:**
   - Usually a transient issue
   - System will recreate temporary file

2. **Check disk space:**

   ```bash
   df -h /tmp
   ```

3. **Check temporary directory permissions:**

   ```bash
   ls -la /tmp | grep deploy-center-ssh
   ```

### "Host key verification failed" Error

**Cause:** Git server's host key not in known_hosts.

**Solutions:**

Deploy Center disables strict host key checking for deployments, so this error is rare.

If it occurs:

1. SSH into Deploy Center server manually
2. Clone repository once to accept host key:

   ```bash
   ssh git@github.com
   # Type 'yes' when prompted
   ```

---

## Best Practices

### ✅ Do

- **Use ED25519 keys** for better security and performance
- **Rotate keys every 90 days** for production projects
- **Delete unused keys** from both Deploy Center and Git platforms
- **Use read-only deploy keys** (don't grant write access)
- **Test deployments immediately** after key rotation
- **Document key rotation** in your deployment logs
- **Use unique keys per project** for better isolation
- **Monitor key usage** in deployment logs

### ❌ Don't

- **Don't share private keys** between projects
- **Don't grant write access** to deploy keys unless absolutely necessary
- **Don't skip key rotation** after team changes
- **Don't reuse keys** from other systems
- **Don't store private keys** anywhere else
- **Don't modify `ENCRYPTION_KEY`** without regenerating all keys
- **Don't use SSH keys for public repositories** (HTTPS is simpler)

---

## Related Documentation

- [Creating Projects](./creating-projects.md) - Project setup guide
- [Deployment Workflows](./deployment-workflows.md) - How deployments work
- [Webhook Setup](./webhooks.md) - Configuring webhooks

---

**Need Help?** Join our [Discord community](https://discord.gg/j8edhTZy) or [open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues).
