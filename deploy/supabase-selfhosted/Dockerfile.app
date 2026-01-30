# GameTaverns Frontend - Production Build
# Build context should be /opt/gametaverns (after install.sh copies files)

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files first (for layer caching)
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies with robust fallback strategy
# Try npm ci first (faster, uses lock file), then npm install as fallback
RUN echo "Installing dependencies..." && \
    if [ -f package-lock.json ]; then \
      echo "Using npm ci (package-lock.json found)"; \
      npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps; \
    else \
      echo "Using npm install (no lock file)"; \
      npm install --legacy-peer-deps; \
    fi && \
    echo "Dependencies installed successfully"

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

# Build the app with verbose error output
RUN echo "Building application..." && \
    npm run build && \
    echo "Build completed successfully" && \
    ls -la dist/ || (echo "BUILD FAILED - dist directory not created" && exit 1)

# Production image using nginx
FROM nginx:1.25-alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx/app.conf /etc/nginx/conf.d/default.conf

# Copy runtime config injection script
COPY scripts/inject-config.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
