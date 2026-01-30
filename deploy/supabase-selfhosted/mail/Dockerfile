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
    && rm -rf /var/lib/apt/lists/*

# Create vmail user
RUN groupadd -g 5000 vmail && \
    useradd -g vmail -u 5000 vmail -d /var/mail/vhosts -s /usr/sbin/nologin && \
    mkdir -p /var/mail/vhosts && \
    chown -R vmail:vmail /var/mail/vhosts

# Copy configuration files
COPY postfix/ /etc/postfix/
COPY dovecot/ /etc/dovecot/
COPY supervisor/ /etc/supervisor/conf.d/
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 25 587 993

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
