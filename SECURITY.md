# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| < 2.0   | :x:                |

**Note:** We strongly recommend using the latest version to benefit from all security updates.

---

## Reporting a Vulnerability

**⚠️ Please DO NOT report security vulnerabilities through public GitHub issues.**

The Deploy Center team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Report security vulnerabilities to:**

**Email:** [security@futuresolutionsdev.com](mailto:security@futuresolutionsdev.com)

**Subject Line Format:**

```
[SECURITY] Brief description of the vulnerability
```

### What to Include

Please include the following information in your report:

1. **Description** — Detailed description of the vulnerability
2. **Impact** — Potential impact if exploited
3. **Affected Versions** — Which versions are affected
4. **Attack Scenario** — Step-by-step instructions to reproduce
5. **Proof of Concept** — Code, screenshots, or videos demonstrating the issue
6. **Suggested Fix** — If you have ideas on how to fix it
7. **Your Contact Information** — How we can reach you for follow-up

### Example Report Template

```markdown
**Vulnerability Type:** SQL Injection / XSS / Authentication Bypass / etc.

**Affected Component:** [e.g., Authentication API, Webhook Handler]

**Affected Versions:** [e.g., v2.0.0 - v2.1.5]

**Severity:** Critical / High / Medium / Low

**Description:**
A detailed description of the vulnerability...

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Impact:**
What an attacker could achieve...

**Proof of Concept:**
```bash
# Example exploit code
curl -X POST http://target/api/vulnerable-endpoint \
  -d "malicious payload"
```

**Suggested Fix:**
Recommendation on how to fix the vulnerability...

**Reporter:**

- Name: Your Name
- Email: <your.email@example.com>
- PGP Key: (Optional, for encrypted communication)

---

## Response Timeline

We aim to respond to security reports according to this timeline:

| Step | Timeline | Description |
|------|----------|-------------|
| **Initial Response** | Within 24 hours | We acknowledge receipt of your report |
| **Triage** | Within 3 business days | We assess severity and impact |
| **Status Update** | Within 7 days | We provide an estimated timeline for a fix |
| **Fix Development** | Varies by severity | We develop and test a fix |
| **Release** | Varies by severity | We release a patched version |
| **Public Disclosure** | After fix release | We publish a security advisory |

### Severity-Based Response

| Severity | Response Time | Fix Timeline |
|----------|---------------|--------------|
| **Critical** | < 24 hours | 1-3 days |
| **High** | < 48 hours | 3-7 days |
| **Medium** | < 5 days | 7-14 days |
| **Low** | < 7 days | 14-30 days |

---

## Security Measures

Deploy Center implements multiple layers of security:

### **1. Authentication & Authorization**

- ✅ **JWT Authentication** — Industry-standard token-based authentication
- ✅ **bcrypt Password Hashing** — 12 rounds for strong password protection
- ✅ **Role-Based Access Control (RBAC)** — Fine-grained permission system
- ✅ **Refresh Token Rotation** — Automatic token renewal
- ✅ **Password Complexity Requirements** — Enforced strong passwords
- ✅ **Account Lockout** — Protection against brute force attacks

### **2. API Security**

- ✅ **Rate Limiting** — Prevent abuse and DoS attacks
  - General API: 100 requests per 15 minutes
  - Authentication: 5 requests per 15 minutes
  - Deployment: 10 requests per 5 minutes
  - Webhooks: 60 requests per minute
- ✅ **Input Validation** — Joi schema validation on all endpoints
- ✅ **Request Sanitization** — Protection against XSS attacks
- ✅ **CORS Configuration** — Whitelist-based origin control
- ✅ **Helmet.js Security Headers** — XSS, clickjacking, and MIME-type sniffing protection
- ✅ **CSRF Protection** — Ready for cookie-based sessions

### **3. Data Security**

- ✅ **AES-256-GCM Encryption** — Sensitive data encrypted at rest
- ✅ **HMAC-SHA256 Signatures** — Webhook payload verification
- ✅ **SQL Injection Prevention** — Sequelize ORM with parameterized queries
- ✅ **Secure Cookie Flags** — HttpOnly, Secure, SameSite
- ✅ **Environment Variable Protection** — Secrets not hardcoded

### **4. Infrastructure Security**

- ✅ **TLS/SSL Support** — HTTPS encryption in transit
- ✅ **Database Connection Pooling** — Resource optimization
- ✅ **Audit Logging** — Comprehensive activity tracking
- ✅ **Error Handling** — No sensitive data in error messages
- ✅ **Dependency Scanning** — Regular security audits

### **5. Deployment Security**

- ✅ **Sandboxed Execution** — Deployments run in isolated environments
- ✅ **Command Validation** — Pipeline commands validated before execution
- ✅ **Timeout Protection** — Prevent resource exhaustion
- ✅ **Webhook Signature Verification** — GitHub HMAC validation

---

## Security Best Practices

### For Users

#### **1. Strong Secrets**

❌ **DON'T:**

```env
JWT_SECRET=secret123
ENCRYPTION_KEY=mykey
```

✅ **DO:**

```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

```env
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6...
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

#### **2. Environment Variables**

❌ **DON'T:**

- Commit `.env` files to version control
- Use default/example secrets in production
- Share secrets in chat/email

✅ **DO:**

- Use `.env.example` as a template
- Generate unique secrets per environment
- Use secret management tools (Vault, AWS Secrets Manager)
- Rotate secrets regularly

#### **3. Database Access**

❌ **DON'T:**

- Use root database user
- Allow remote root access
- Use weak database passwords

✅ **DO:**

- Create dedicated database user
- Grant only necessary privileges
- Use strong database passwords
- Restrict database access to localhost (or specific IPs)

```sql
-- ✅ Good
CREATE USER 'deploy_user'@'localhost' IDENTIFIED BY 'Str0ng_P@ssw0rd!';
GRANT SELECT, INSERT, UPDATE, DELETE ON deploy_center.* TO 'deploy_user'@'localhost';
FLUSH PRIVILEGES;

-- ❌ Bad
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
```

#### **4. Webhook Configuration**

❌ **DON'T:**

- Use HTTP for webhooks (use HTTPS)
- Reuse webhook secrets across projects
- Expose webhook URLs publicly

✅ **DO:**

- Always use HTTPS in production
- Generate unique webhook secret per project
- Regenerate webhook secrets periodically
- Monitor webhook logs for suspicious activity

#### **5. Server Hardening**

✅ **Firewall Configuration**

```bash
# Allow only necessary ports
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw deny 3306  # Block external MySQL access
sudo ufw enable
```

✅ **Keep Software Updated**

```bash
# Regular updates
sudo apt update && sudo apt upgrade -y
npm audit fix
```

✅ **Use TLS/SSL**

```bash
# Use Let's Encrypt
sudo certbot --nginx -d deploy.yourdomain.com
```

#### **6. Monitoring & Logging**

✅ **Review Logs Regularly**

```bash
# Check for suspicious activity
tail -f logs/combined-*.log
tail -f logs/error-*.log

# Look for:
# - Repeated failed login attempts
# - Unusual deployment patterns
# - Unexpected API calls
```

✅ **Set Up Alerts**

- Failed authentication attempts
- Deployment failures
- Unusual queue activity
- Error spikes

---

## Known Security Limitations

We believe in transparency. Here are current known limitations:

### **1. Deployment Isolation**

**Limitation:** Deployments run on the same server as the Deploy Center instance.

**Risk:** Malicious deployment commands could affect the host system.

**Mitigation:**

- Only allow trusted users to create projects
- Review pipeline configurations before approval
- Consider containerized deployments (Docker) for isolation

### **2. Command Execution**

**Limitation:** Pipeline commands are executed via shell.

**Risk:** Command injection if pipeline configuration is not validated.

**Mitigation:**

- Only admins can create/edit projects
- Pipeline configurations are validated
- Audit all project configurations

### **3. Rate Limiting**

**Limitation:** Rate limiting is per-IP, not per-user.

**Risk:** Attackers behind NAT can share rate limit.

**Mitigation:**

- Additional authentication-based rate limiting
- Monitor for abuse patterns
- Implement IP whitelisting if needed

### **Future Improvements**

- 🔜 Container-based deployment isolation (Docker/Podman)
- 🔜 Enhanced command sanitization
- 🔜 User-based rate limiting
- 🔜 Two-factor authentication (2FA)
- 🔜 OAuth/SSO support
- 🔜 IP whitelisting per project
- 🔜 Deployment approval workflows

---

## Security Updates

### Subscribe to Security Advisories

Stay informed about security updates:

1. **Watch the Repository**
   - Go to [Deploy Center Repository](https://github.com/FutureSolutionDev/Deploy-Center-Server)
   - Click **Watch** → **Custom** → Check **Security alerts**

2. **GitHub Security Advisories**
   - Visit [Security Advisories](https://github.com/FutureSolutionDev/Deploy-Center-Server/security/advisories)

3. **Email Notifications**
   - Subscribe to our [security mailing list](#) _(coming soon)_

### Security Release Process

When we release a security patch:

1. **Develop Fix** — We develop and test the fix privately
2. **Security Advisory** — We publish a GitHub Security Advisory
3. **Release Patch** — We release a new version with the fix
4. **Update Documentation** — We update this policy and changelog
5. **Notify Users** — We send notifications to affected users
6. **Public Disclosure** — We publish full details after users have time to update

---

## Security Checklist

### For Administrators

Use this checklist to ensure your Deploy Center instance is secure:

#### **Initial Setup**

- [ ] Generated strong JWT secrets (64+ bytes)
- [ ] Generated strong encryption key (32 bytes)
- [ ] Created dedicated database user (not root)
- [ ] Database allows connections only from localhost
- [ ] Changed default admin password
- [ ] Configured CORS with specific origins (not `*`)
- [ ] Set `NODE_ENV=production` in production
- [ ] Configured HTTPS/TLS with valid certificate

#### **Ongoing Maintenance**

- [ ] Regularly update Deploy Center to latest version
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Review audit logs weekly
- [ ] Rotate secrets every 90 days
- [ ] Review user accounts and remove inactive users
- [ ] Monitor failed authentication attempts
- [ ] Check deployment logs for suspicious commands
- [ ] Backup database regularly
- [ ] Test restore process
- [ ] Review firewall rules
- [ ] Keep OS and dependencies updated

#### **Project Configuration**

- [ ] Review all pipeline configurations
- [ ] Validate deployment commands
- [ ] Use least-privilege principles for deployment users
- [ ] Enable notifications for deployment failures
- [ ] Set appropriate rate limits
- [ ] Use webhook secrets for all projects
- [ ] Regenerate webhook secrets if suspected compromise

---

## Responsible Disclosure

We support responsible disclosure and will:

✅ Acknowledge your report within 24 hours
✅ Keep you informed of our progress
✅ Credit you in the security advisory (if desired)
✅ Not pursue legal action against good-faith security researchers

We ask that you:

✅ Give us reasonable time to fix the issue before public disclosure
✅ Do not exploit the vulnerability beyond proving it exists
✅ Do not access, modify, or delete user data
✅ Act in good faith to avoid privacy violations and service disruption

---

## Bug Bounty Program

**Status:** Not currently available

We're considering launching a bug bounty program in the future. For now, we appreciate responsible disclosure and will publicly acknowledge security researchers.

**Interested in sponsoring a bug bounty program?** Contact: [security@futuresolutionsdev.com](mailto:security@futuresolutionsdev.com)

---

## PGP Key

For encrypted communication of sensitive security issues:

```bash
-----BEGIN PGP PUBLIC KEY BLOCK-----
(PGP Key will be published here)
-----END PGP PUBLIC KEY BLOCK-----
```

**Fingerprint:** `(Will be published)`

---

## Security Hall of Fame

We thank these security researchers for responsibly disclosing vulnerabilities:

_(No vulnerabilities reported yet — be the first!)_

---

## Contact

For security-related questions or concerns:

- **Security Issues:** [security@futuresolutionsdev.com](mailto:security@futuresolutionsdev.com)
- **General Support:** [support@futuresolutionsdev.com](mailto:support@futuresolutionsdev.com)
- **Website:** [futuresolutionsdev.com](https://futuresolutionsdev.com)

---

## Legal

By reporting vulnerabilities to us, you agree that:

1. You will not publicly disclose the vulnerability until we have released a fix
2. You conducted testing in good faith and did not access, modify, or delete user data
3. You will not demand payment or compensation for the vulnerability report
4. Deploy Center reserves the right to determine the severity and validity of reports

We commit to:

1. Responding promptly to your report
2. Keeping you informed of our progress
3. Crediting you in the security advisory (if you wish)
4. Not pursuing legal action for good-faith security research

---

<div align="center">

**Thank you for helping keep Deploy Center and our users safe!**

🛡️ **Security is a shared responsibility** 🛡️

Made with ❤️ by [FutureSolutionDev](https://futuresolutionsdev.com)

</div>
