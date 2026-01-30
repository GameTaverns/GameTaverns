# GameTaverns Mail Server
# Postfix (SMTP) + Dovecot (IMAP)

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install packages
RUN apt-get update && apt-get install -y \
    postfix \
    postfix-pcre \
    dovecot-core \
    dovecot-imapd \
    dovecot-lmtpd \
    opendkim \
    opendkim-tools \
    supervisor \
    rsyslog \
    ssl-cert \
    swaks \
    && rm -rf /var/lib/apt/lists/*

# Create vmail user
RUN groupadd -g 5000 vmail && \
    useradd -g vmail -u 5000 vmail -d /var/mail/vhosts -s /usr/sbin/nologin && \
    mkdir -p /var/mail/vhosts && \
    chown -R vmail:vmail /var/mail/vhosts

# Create supervisor config directory
RUN mkdir -p /etc/supervisor/conf.d

# Copy configuration files
COPY postfix/main.cf /etc/postfix/main.cf
COPY postfix/master.cf /etc/postfix/master.cf
COPY dovecot/dovecot.conf /etc/dovecot/dovecot.conf
COPY dovecot/conf.d/ /etc/dovecot/conf.d/
COPY supervisor/supervisord.conf /etc/supervisor/supervisord.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

# Create empty dovecot users file with correct permissions
RUN touch /etc/dovecot/users && chown root:dovecot /etc/dovecot/users && chmod 640 /etc/dovecot/users

EXPOSE 25 587 993

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
