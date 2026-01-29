# GameTaverns Frontend
# Multi-stage build for production

# ===================
# Stage 1: Build
# ===================
FROM node:20-alpine AS builder

ARG VITE_API_URL=/api
ARG VITE_SITE_NAME=GameTaverns

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Set build-time env vars
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SITE_NAME=${VITE_SITE_NAME}
ENV VITE_STANDALONE=true

# Build the application
RUN npm run build

# ===================
# Stage 2: Production
# ===================
FROM nginx:alpine

# Install envsubst for runtime config
RUN apk add --no-cache bash

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY deploy/multitenant/nginx/app.conf /etc/nginx/conf.d/default.conf

# Copy startup script for runtime config
COPY deploy/multitenant/scripts/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
