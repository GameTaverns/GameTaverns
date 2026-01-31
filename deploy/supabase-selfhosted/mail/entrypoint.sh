#!/bin/bash
# Mail server entrypoint
# Version: 2.1.0

set -e

# Ensure environment variables have defaults
MAIL_DOMAIN="${MAIL_DOMAIN:-localhost}"
POSTMASTER_EMAIL="${POSTMASTER_EMAIL:-postmaster@${MAIL_DOMAIN}}"

echo "=============================================="
echo "  Configuring Mail Server"
echo "  Version: 2.1.0"
echo "  Domain: ${MAIL_DOMAIN}"
echo "  Postmaster: ${POSTMASTER_EMAIL}"
echo "=============================================="
echo ""

# Ensure required directories exist with correct permissions
mkdir -p /var/spool/postfix
mkdir -p /var/spool/rsyslog
mkdir -p /var/log
mkdir -p /run/dovecot
mkdir -p /var/lib/dovecot

# Set proper permissions for Dovecot runtime
chmod 755 /run/dovecot

# Configure Postfix with proper quoting
postconf -e "myhostname=mail.${MAIL_DOMAIN}"
postconf -e "mydomain=${MAIL_DOMAIN}"
postconf -e "myorigin=\$mydomain"
postconf -e "mydestination=\$myhostname, localhost.\$mydomain, localhost, \$mydomain"
postconf -e "virtual_mailbox_domains=${MAIL_DOMAIN}"
postconf -e "virtual_mailbox_base=/var/mail/vhosts"
postconf -e "virtual_mailbox_maps=hash:/etc/postfix/vmailbox"
postconf -e "virtual_uid_maps=static:5000"
postconf -e "virtual_gid_maps=static:5000"
postconf -e "smtpd_tls_security_level=may"
postconf -e "smtp_tls_security_level=may"
postconf -e "smtpd_relay_restrictions=permit_mynetworks,permit_sasl_authenticated,reject_unauth_destination"

# Create virtual mailbox file if it doesn't exist
mkdir -p /etc/postfix
if [ ! -f /etc/postfix/vmailbox ]; then
    echo "${POSTMASTER_EMAIL}    ${MAIL_DOMAIN}/postmaster/" > /etc/postfix/vmailbox
fi
postmap /etc/postfix/vmailbox

# Create mailbox directories with correct permissions
mkdir -p "/var/mail/vhosts/${MAIL_DOMAIN}"
mkdir -p "/var/mail/vhosts/${MAIL_DOMAIN}/postmaster"

# Ensure vmail user exists (uid/gid 5000)
if ! getent passwd vmail > /dev/null 2>&1; then
    groupadd -g 5000 vmail 2>/dev/null || true
    useradd -u 5000 -g 5000 -s /sbin/nologin -d /var/mail/vhosts vmail 2>/dev/null || true
fi
chown -R vmail:vmail "/var/mail/vhosts"
chmod -R 700 "/var/mail/vhosts"

# Configure Dovecot directories
mkdir -p /etc/dovecot/conf.d

cat > /etc/dovecot/conf.d/10-mail.conf << EOF
mail_location = maildir:/var/mail/vhosts/%d/%n
mail_uid = vmail
mail_gid = vmail
first_valid_uid = 5000
last_valid_uid = 5000
EOF

cat > /etc/dovecot/conf.d/10-auth.conf << EOF
disable_plaintext_auth = no
auth_mechanisms = plain login
!include auth-passwdfile.conf.ext
EOF

cat > /etc/dovecot/conf.d/auth-passwdfile.conf.ext << EOF
passdb {
  driver = passwd-file
  args = /etc/dovecot/users
}
userdb {
  driver = static
  args = uid=vmail gid=vmail home=/var/mail/vhosts/%d/%n
}
EOF

# Create users file if it doesn't exist
# Permissions: root:dovecot 640 for security
if [ ! -f /etc/dovecot/users ]; then
    touch /etc/dovecot/users
fi

# Handle dovecot group existence
if getent group dovecot > /dev/null 2>&1; then
    chown root:dovecot /etc/dovecot/users
else
    chown root:root /etc/dovecot/users
fi
chmod 640 /etc/dovecot/users

echo "✓ Postfix configured"
echo "✓ Dovecot configured"
echo "✓ Mail server ready for ${MAIL_DOMAIN}"
echo ""

exec "$@"
