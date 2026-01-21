# Game Haven - Cloudron + PocketBase Deployment
# Single container with both frontend and PocketBase backend

FROM cloudron/base:4.2.0@sha256:46da2fffb36353ef714f97ae8e962bd2c212ca091108d768ba473078319a47f4

# Install Node.js 20, nginx, and wget for PocketBase download
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs nginx wget unzip && \
    npm install -g npm@latest && \
    rm -rf /var/lib/apt/lists/*

# Download and install PocketBase
ARG POCKETBASE_VERSION=0.23.4
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip && \
    unzip pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip -d /usr/local/bin && \
    rm pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip && \
    chmod +x /usr/local/bin/pocketbase

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Build with PocketBase URL pointing to same container
ENV VITE_POCKETBASE_URL=/api
RUN npm run build

# Setup nginx and startup
COPY deploy/cloudron/nginx.conf /etc/nginx/sites-available/default
COPY deploy/cloudron/start.sh /app/start.sh
RUN chmod +x /app/start.sh && \
    rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Create data directory for PocketBase
RUN mkdir -p /app/data/pb_data

EXPOSE 80

CMD ["/app/start.sh"]
