# GameTaverns Frontend - Production Build
# Build context should be /opt/gametaverns (after install.sh copies files)
# Version: 2.0.0

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies including curl for healthchecks
RUN apk add --no-cache git python3 make g++ curl

# Copy package files first (for layer caching)
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies with robust fallback strategy
# Try npm ci first (faster, uses lock file), then npm install as fallback
RUN echo "Installing dependencies..." && \
    if [ -f package-lock.json ]; then \
      echo "Using npm ci (package-lock.json found)"; \
      npm ci --legacy-peer-deps 2>&1 || { \
        echo "npm ci failed, falling back to npm install"; \
        npm install --legacy-peer-deps; \
      }; \
    else \
      echo "Using npm install (no lock file)"; \
      npm install --legacy-peer-deps; \
    fi && \
    echo "Dependencies installed successfully" && \
    ls -la node_modules/.bin/ | head -5

# Copy configuration files - use explicit list
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.app.json* ./
COPY tsconfig.node.json* ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY index.html ./

# Copy components.json if exists (shadcn config)
COPY components.json* ./

# Copy source code
COPY src ./src
COPY public ./public

# Build arguments
ARG VITE_BUILD_DATE
ENV VITE_BUILD_DATE=${VITE_BUILD_DATE:-unknown}
ENV NODE_ENV=production

# Build the app with verbose error output and memory limits
RUN echo "Building application..." && \
    echo "Node version: $(node --version)" && \
    echo "NPM version: $(npm --version)" && \
    NODE_OPTIONS="--max-old-space-size=2048" npm run build 2>&1 && \
    echo "Build completed successfully" && \
    ls -la dist/ && \
    test -f dist/index.html || (echo "BUILD FAILED - index.html not found in dist" && exit 1)

# Production image using nginx
FROM nginx:1.25-alpine

# Install curl for healthcheck (wget may not be reliable)
RUN apk add --no-cache curl

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx/app.conf /etc/nginx/conf.d/default.conf

# Copy runtime config injection script
COPY scripts/inject-config.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh

# Set proper permissions for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    # Ensure nginx can write to cache directories
    mkdir -p /var/cache/nginx /var/run && \
    chown -R nginx:nginx /var/cache/nginx /var/run

# Healthcheck using curl (more reliable than wget)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
