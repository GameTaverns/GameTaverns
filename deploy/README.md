# GameTaverns Deployment

Deploy your own GameTaverns instance in minutes.

## Quick Start (Recommended)

```bash
# 1. Get a fresh Ubuntu 24.04 server (any VPS provider)

# 2. Clone and install
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/native
sudo ./install.sh

# 3. Follow the prompts. Done!
```

The installer handles everything automatically:
- Database (PostgreSQL 16)
- Web server (Nginx)
- Email (Postfix + Dovecot)  
- SSL certificates (Certbot)
- Security (Firewall + Fail2ban)

## Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Ubuntu 24.04 LTS |
| RAM | 4 GB |
| Disk | 20 GB |
| CPU | 2 cores |

## After Installation

1. **Point your domain** to your server's IP address
2. **Set up SSL**: `sudo certbot --nginx -d yourdomain.com`
3. **Log in** at `https://yourdomain.com` with the admin account you created

## Management

| Task | Command |
|------|---------|
| View logs | `pm2 logs gametaverns-api` |
| Restart | `pm2 restart gametaverns-api` |
| Backup | `./deploy/native/scripts/backup.sh` |
| Update | `./deploy/native/scripts/update.sh` |
| Server GUI | `https://your-server-ip:9090` (Cockpit) |

## Support

- **Issues**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
