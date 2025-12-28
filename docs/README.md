# Deploy Center Documentation

Welcome to the Deploy Center documentation! This directory contains comprehensive guides and references for using, deploying, and contributing to Deploy Center.

---

## 📚 Quick Navigation

### 🚀 Getting Started

Start here if you're new to Deploy Center:

1. **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 5 minutes
2. **[Installation Guide](./INSTALLATION.md)** - Detailed installation instructions
3. **[Project Structure](./PROJECT_STRUCTURE.md)** - Understanding the codebase

### 📖 Core Documentation

Essential documentation for daily use:

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference with examples
- **[Webhooks Setup](./WEBHOOKS_SETUP.md)** - Configure GitHub webhooks
- **[GitHub Private Repos Setup](./GITHUB_PRIVATE_REPOS_SETUP.md)** - Connect private repositories
- **[Postman Guide](./POSTMAN_GUIDE.md)** - API testing with Postman

### 🔮 Planning & Roadmap

Future vision and feature tracking:

- **[Vision & Roadmap](./VISION.md)** - Long-term vision and quarterly roadmap
- **[Features & TODO](./FEATURES_TODO.md)** - Complete feature tracking (120+ features)
- **[Release Guide](./RELEASE_GUIDE.md)** - Release process and versioning

### 🎯 Advanced Guides

In-depth guides for specific scenarios:

- **[GitHub Repository Setup](./guides/GITHUB_SETUP.md)** - Configure your GitHub repository
- **[Contributing](../CONTRIBUTING.md)** - How to contribute to Deploy Center
- **[Security Policy](../SECURITY.md)** - Security and vulnerability reporting

---

## 📂 Documentation Structure

```
docs/
├── README.md                           # This file - Documentation index
├── QUICK_START.md                      # 5-minute quick start
├── INSTALLATION.md                     # Detailed installation
├── API_DOCUMENTATION.md                # Complete API reference
├── WEBHOOKS_SETUP.md                   # GitHub webhooks configuration
├── GITHUB_PRIVATE_REPOS_SETUP.md       # Private repository access
├── POSTMAN_GUIDE.md                    # Postman collection guide
├── PROJECT_STRUCTURE.md                # Codebase architecture
├── VISION.md                           # Future roadmap
├── FEATURES_TODO.md                    # Feature tracking
├── RELEASE_GUIDE.md                    # Release process
└── guides/                             # Advanced guides
    └── GITHUB_SETUP.md                 # GitHub repo configuration
```

---

## 🎓 Learning Path

### For New Users

1. Read [Quick Start Guide](./QUICK_START.md)
2. Set up [GitHub Webhooks](./WEBHOOKS_SETUP.md)
3. Create your first deployment
4. Explore [API Documentation](./API_DOCUMENTATION.md)

### For Developers

1. Understand [Project Structure](./PROJECT_STRUCTURE.md)
2. Review [API Documentation](./API_DOCUMENTATION.md)
3. Read [Contributing Guide](../CONTRIBUTING.md)
4. Check [Features TODO](./FEATURES_TODO.md) for available tasks

### For DevOps Engineers

1. Follow [Installation Guide](./INSTALLATION.md)
2. Configure [GitHub Webhooks](./WEBHOOKS_SETUP.md)
3. Set up [Private Repos](./GITHUB_PRIVATE_REPOS_SETUP.md)
4. Review [Release Guide](./RELEASE_GUIDE.md)

### For Project Managers

1. Read [Vision & Roadmap](./VISION.md)
2. Review [Features TODO](./FEATURES_TODO.md)
3. Check [API Documentation](./API_DOCUMENTATION.md)

---

## 🔍 Quick Reference

### Installation

```bash
# Quick install
cd server
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

See [Installation Guide](./INSTALLATION.md) for details.

### API Endpoints

**Base URL:** `http://localhost:5000/api/v1`

**Authentication:** JWT via httpOnly cookies

See [API Documentation](./API_DOCUMENTATION.md) for complete reference.

### Common Tasks

| Task | Documentation |
|------|---------------|
| Install Deploy Center | [Installation Guide](./INSTALLATION.md) |
| Configure webhooks | [Webhooks Setup](./WEBHOOKS_SETUP.md) |
| Test APIs | [Postman Guide](./POSTMAN_GUIDE.md) |
| Connect private repos | [GitHub Private Repos](./GITHUB_PRIVATE_REPOS_SETUP.md) |
| Contribute code | [Contributing Guide](../CONTRIBUTING.md) |
| Report security issue | [Security Policy](../SECURITY.md) |
| Check roadmap | [Vision Document](./VISION.md) |

---

## 🆘 Getting Help

### Documentation

- Browse this documentation directory
- Check [FAQ section](#faq) below
- Review [API Documentation](./API_DOCUMENTATION.md)

### Community

- **GitHub Issues:** [Report bugs or request features](https://github.com/FutureSolutionDev/deploy-center/issues)
- **GitHub Discussions:** [Ask questions and share ideas](https://github.com/FutureSolutionDev/deploy-center/discussions)
- **Email:** support@futuresolutionsdev.com

### Support

See [SUPPORT.md](../SUPPORT.md) for detailed support options.

---

## 📝 Contributing to Documentation

Documentation improvements are always welcome!

### How to Contribute

1. Fork the repository
2. Create a branch (`git checkout -b docs/improve-installation`)
3. Make your changes
4. Test your changes (check all links work)
5. Submit a pull request

### Documentation Standards

- Use **Markdown** formatting
- Include **code examples** where applicable
- Add **screenshots** for UI-related docs
- Keep **table of contents** updated
- Use **clear, concise language**
- Include **practical examples**

See [Contributing Guide](../CONTRIBUTING.md) for details.

---

## 🔄 Documentation Updates

This documentation is actively maintained. Last major update: **December 28, 2024**

### Recent Changes

- ✅ Added complete API Documentation
- ✅ Created Vision & Roadmap document
- ✅ Added Features TODO tracking
- ✅ Reorganized documentation structure
- ✅ Updated all guides with v2.1.0 features

### Upcoming Documentation

- [ ] Docker deployment guide
- [ ] Kubernetes deployment guide
- [ ] Performance tuning guide
- [ ] Advanced security hardening guide
- [ ] Migration guide from v1.x to v2.x

See [FEATURES_TODO.md](./FEATURES_TODO.md) for complete list.

---

## 📊 Documentation Statistics

- **Total Documentation Files:** 12+
- **Total Lines:** 5000+
- **API Endpoints Documented:** 60+
- **Features Documented:** 120+
- **Code Examples:** 50+
- **Diagrams:** 10+

---

## ❓ FAQ

### General Questions

**Q: Where should I start?**
A: Start with the [Quick Start Guide](./QUICK_START.md) to get Deploy Center running in 5 minutes.

**Q: How do I set up GitHub webhooks?**
A: Follow the [Webhooks Setup Guide](./WEBHOOKS_SETUP.md) for step-by-step instructions.

**Q: Can I use private GitHub repositories?**
A: Yes! See [GitHub Private Repos Setup](./GITHUB_PRIVATE_REPOS_SETUP.md).

### Technical Questions

**Q: What's the minimum Node.js version required?**
A: Node.js 18.0.0 or higher. See [Installation Guide](./INSTALLATION.md).

**Q: Which databases are supported?**
A: MySQL 8.0+ and MariaDB 10.6+. See [Installation Guide](./INSTALLATION.md).

**Q: How do I test the API?**
A: Use the provided Postman collection. See [Postman Guide](./POSTMAN_GUIDE.md).

### Deployment Questions

**Q: Can I deploy to multiple servers?**
A: Yes, but currently requires manual configuration. Multi-server support is planned for Q3 2025. See [Vision Document](./VISION.md).

**Q: How do I rollback a deployment?**
A: Use the rollback API endpoint or UI. See [API Documentation](./API_DOCUMENTATION.md).

**Q: Can I schedule deployments?**
A: Not yet, but it's planned for Q2 2025. See [Features TODO](./FEATURES_TODO.md).

---

## 🔗 External Resources

### Technologies Used

- [Node.js Documentation](https://nodejs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Sequelize ORM Docs](https://sequelize.org/)
- [Socket.IO Documentation](https://socket.io/docs/)

### Related Tools

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [PM2 Process Manager](https://pm2.keymetrics.io/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## 📄 License

This documentation is part of Deploy Center and is covered under the same [Dual License](../LICENSE).

---

<div align="center">

**Need help?** [Open an issue](https://github.com/FutureSolutionDev/Deploy-Center-Server/issues) or [contact support](mailto:support@futuresolutionsdev.com)

**Want to contribute?** See [Contributing Guide](../CONTRIBUTING.md)

**© 2024-2025 FutureSolutionDev. All Rights Reserved.**

</div>
