# GameTaverns Deployment

Deploy your own GameTaverns instance in ~15 minutes.

## Quick Start

```bash
# 1. Get a fresh Ubuntu 24.04 server (any VPS provider)

# 2. Clone and install
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/native
sudo ./install.sh

# 3. Follow the prompts. Done!
```

The installer handles everything:
- **Database**: PostgreSQL 16
- **Web Server**: Nginx with rate limiting
- **Email**: Postfix + Dovecot + Roundcube webmail
- **Security**: UFW firewall, Fail2ban, SSL ready
- **Monitoring**: Cockpit web console

## Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 24.04 LTS |
| RAM | 4 GB |
| Disk | 20 GB |
| CPU | 2 cores |

## After Installation

1. **Point your domain** to your server's IP address
2. **Set up SSL**: `sudo ./scripts/setup-ssl.sh`
3. **Set up automation**: `sudo ./scripts/setup-cron.sh`
4. **Log in** at `https://yourdomain.com`

## Management Commands

| Task | Command |
|------|---------|
| Health check | `./scripts/health-check.sh` |
| View logs | `./scripts/view-logs.sh` |
| Security audit | `./scripts/security-audit.sh` |
| Backup | `./scripts/backup.sh` |
| Update | `./scripts/update.sh` |
| Add mail user | `./scripts/add-mail-user.sh add user@domain.com` |
| Server GUI | `https://your-server-ip:9090` (Cockpit) |

## Documentation

- **[Native Install Guide](native/README.md)** - Full documentation
- **[Architecture](ARCHITECTURE.md)** - System design
- **[Self-Hosting Guide](SELF-HOSTING.md)** - Advanced configuration

## Support

- **GitHub**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
