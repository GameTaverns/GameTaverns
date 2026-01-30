#!/bin/bash
# Mail server entrypoint

set -e

MAIL_DOMAIN=${MAIL_DOMAIN:-localhost}
POSTMASTER_EMAIL=${POSTMASTER_EMAIL:-postmaster@$MAIL_DOMAIN}

echo "Configuring mail server for domain: $MAIL_DOMAIN"

# Configure Postfix
postconf -e "myhostname=mail.$MAIL_DOMAIN"
postconf -e "mydomain=$MAIL_DOMAIN"
postconf -e "myorigin=\$mydomain"
postconf -e "mydestination=\$myhostname, localhost.\$mydomain, localhost, \$mydomain"
postconf -e "virtual_mailbox_domains=$MAIL_DOMAIN"
postconf -e "virtual_mailbox_base=/var/mail/vhosts"
postconf -e "virtual_mailbox_maps=hash:/etc/postfix/vmailbox"
postconf -e "virtual_uid_maps=static:5000"
postconf -e "virtual_gid_maps=static:5000"
postconf -e "smtpd_tls_security_level=may"
postconf -e "smtp_tls_security_level=may"

# Create virtual mailbox file if it doesn't exist
if [ ! -f /etc/postfix/vmailbox ]; then
    echo "$POSTMASTER_EMAIL    $MAIL_DOMAIN/postmaster/" > /etc/postfix/vmailbox
    postmap /etc/postfix/vmailbox
fi

# Create mailbox directories
mkdir -p "/var/mail/vhosts/$MAIL_DOMAIN"
chown -R vmail:vmail "/var/mail/vhosts/$MAIL_DOMAIN"

# Configure Dovecot
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
if [ ! -f /etc/dovecot/users ]; then
    touch /etc/dovecot/users
    chmod 600 /etc/dovecot/users
fi

echo "Mail server configured"

exec "$@"
