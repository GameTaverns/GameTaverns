# GameTaverns Frontend
# Multi-stage build for production
# Version: 2.2.0 - 5-Tier Role Hierarchy
# Last Audit: 2026-01-31

# ===================
# Stage 1: Build
# ===================
FROM node:20-alpine AS builder

ARG VITE_API_URL=/api
ARG VITE_SITE_NAME=GameTaverns

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies with robust fallback strategy
# Use --legacy-peer-deps to handle peer dependency conflicts
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
    echo "Dependencies installed successfully"

# Copy source
COPY . .

# Set build-time env vars
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SITE_NAME=${VITE_SITE_NAME}
ENV VITE_STANDALONE=true

# Build the application with memory limits
RUN echo "Building application..." && \
    NODE_OPTIONS="--max-old-space-size=2048" npm run build && \
    echo "Build completed successfully" && \
    ls -la dist/ && \
    test -f dist/index.html || (echo "BUILD FAILED - index.html not found" && exit 1)

# ===================
# Stage 2: Production
# ===================
FROM nginx:alpine

# Install envsubst for runtime config
RUN apk add --no-cache bash curl

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY deploy/multitenant/nginx/app.conf /etc/nginx/conf.d/default.conf

# Copy startup script for runtime config
COPY deploy/multitenant/scripts/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
