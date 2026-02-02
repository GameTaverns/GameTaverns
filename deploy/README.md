# GameTaverns Deployment

Deploy your own GameTaverns instance in ~15 minutes.

## Recommended: Supabase Self-Hosted (Full Feature Parity)

The **supabase-selfhosted** deployment provides 1:1 feature parity with Lovable Cloud and is the recommended option.

### Quick Start (2 Steps)

```bash
# STEP 1: Bootstrap server (installs Docker, Nginx, Certbot, etc.)
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh | sudo bash

# STEP 2: Clone and install (handles EVERYTHING)
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/supabase-selfhosted
sudo ./install.sh
```

The installer handles:
- ✓ Security key generation
- ✓ API key configuration (Discord, Perplexity, Turnstile, etc.)
- ✓ Database setup & migrations
- ✓ Frontend build
- ✓ Mail server (Postfix + Dovecot + SOGo webmail)
- ✓ SSL certificates
- ✓ Admin user creation

### Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 22.04/24.04 LTS |
| RAM | 2 GB (4 GB recommended) |
| Disk | 20 GB |
| CPU | 1 core (2+ recommended) |

### After Installation

1. **Point your domain** to your server's IP address (including `*.yourdomain.com` for tenant subdomains)
2. **Log in** at `https://yourdomain.com` with the admin credentials you created

### Management Commands

| Task | Command |
|------|---------|
| View logs | `docker compose logs -f` |
| Check status | `docker compose ps` |
| Restart services | `docker compose restart` |
| Backup database | `./scripts/backup.sh` |
| Update | `./scripts/update.sh` |

## Alternative Deployments

| Deployment | Description | Use Case |
|------------|-------------|----------|
| [supabase-selfhosted](supabase-selfhosted/) | Full Supabase stack with Docker | **Recommended** - Production |
| [native](native/) | Direct PostgreSQL + PM2 | Minimal resources |
| [multitenant](multitenant/) | Multi-tenant Docker | Service providers |
| [cloudron](cloudron/) | Cloudron package | Cloudron users |

## Documentation

- **[Supabase Self-Hosted Guide](supabase-selfhosted/README.md)** - Full documentation
- **[Architecture](ARCHITECTURE.md)** - System design
- **[Self-Hosting Guide](SELF-HOSTING.md)** - Advanced configuration
- **[Migration Guide](supabase-selfhosted/MIGRATION.md)** - Import existing data

## Support

- **GitHub**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
