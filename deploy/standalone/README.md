# Game Haven - Standalone Self-Hosted Deployment

Self-host Game Haven on your own server with Docker.

## Choose Your Stack

| Version | Description | Complexity | Documentation |
|---------|-------------|------------|---------------|
| **[v2 (Recommended)](./README-v2.md)** | Simplified Express + Postgres | 3 containers | [View Guide →](./README-v2.md) |
| **[v1 (Legacy)](./README-v1.md)** | Full Supabase platform | 7+ containers | [View Guide →](./README-v1.md) |

### Which should I choose?

**Choose v2 if you want:**
- Simple setup with minimal configuration
- Lower resource usage (2GB RAM)
- Easy debugging and maintenance
- Compatibility with Cloudron, Softaculous, shared hosting

**Choose v1 if you need:**
- Full Supabase platform features
- Real-time subscriptions
- Supabase Studio for database management
- Feature parity with Lovable Cloud

---

## Quick Start

### v2 (Recommended)

```bash
curl -fsSL https://get.docker.com | sh && \
git clone https://github.com/ThaneWinters/GameTavern.git && \
cd GameTavern/deploy/standalone && \
chmod +x install.sh scripts/*.sh && \
./install.sh --v2
```

### v1 (Legacy)

```bash
curl -fsSL https://get.docker.com | sh && \
git clone https://github.com/ThaneWinters/GameTavern.git && \
cd GameTavern/deploy/standalone && \
chmod +x install.sh scripts/*.sh && \
./install.sh
```

---

## Requirements

| Requirement | v2 | v1 |
|-------------|----|----|
| Docker | 20.10+ | 20.10+ |
| Docker Compose | 2.0+ | 2.0+ |
| RAM | 2GB min | 4GB min (8GB recommended) |
| Disk Space | 10GB | 20GB |

---

## Platform Support

| Platform | v2 | v1 |
|----------|----|----|
| Docker Compose | ✅ | ✅ |
| Ubuntu/Debian | ✅ | ✅ |
| Cloudron | ✅ | ⚠️ Complex |
| Softaculous | ✅ | ❌ |
| Windows (Docker Desktop) | ✅ | ✅ |

---

## Feature Comparison

| Feature | v2 | v1 |
|---------|----|----|
| Game Management | ✅ | ✅ |
| BGG Import | ✅ | ✅ |
| Play Logs | ✅ | ✅ |
| Wishlist | ✅ | ✅ |
| Messaging | ✅ | ✅ |
| Ratings | ✅ | ✅ |
| AI Descriptions | ✅ BYOK | ✅ BYOK |
| Real-time Updates | ❌ | ✅ |
| Supabase Studio | ❌ | ✅ |
| Edge Functions | ❌ (Express routes) | ✅ |

---

## More Information

- **[v2 Documentation](./README-v2.md)** - Full setup, configuration, and troubleshooting
- **[v1 Documentation](./README-v1.md)** - Legacy Supabase stack documentation
- **[Architecture Overview](../ARCHITECTURE.md)** - Technical details and diagrams
- **[Cloudron Guide](../cloudron/README.md)** - Cloudron-specific installation
