# Cloudron Dockerfile for Game Haven
# This builds a self-contained app for Cloudron deployment

FROM cloudron/base:4.2.0@sha256:46da2fffb36353ef714f97ae8e962bd2c212ca091108d768ba473078319a47f4

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# Install nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the app (env vars injected at runtime via start.sh)
RUN npm run build

# Copy Cloudron-specific files
COPY deploy/cloudron/start.sh /app/start.sh
COPY deploy/cloudron/nginx.conf /etc/nginx/sites-available/default

RUN chmod +x /app/start.sh

# Cloudron uses /app/data for persistent storage
RUN mkdir -p /app/data

CMD ["/app/start.sh"]
