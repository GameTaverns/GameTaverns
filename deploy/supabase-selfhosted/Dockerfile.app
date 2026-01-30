# GameTaverns Frontend - Production Build
# Build context should be /opt/gametaverns (after install.sh copies files)

FROM node:20-alpine AS builder

WORKDIR /app

# Install bun for faster installs (optional fallback to npm)
RUN npm install -g bun || true

# Copy package files first (for caching)
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies (try bun first, fallback to npm)
RUN if command -v bun > /dev/null 2>&1 && [ -f bun.lockb ]; then \
      bun install --frozen-lockfile; \
    else \
      npm ci --legacy-peer-deps || npm install --legacy-peer-deps; \
    fi

# Copy configuration files
COPY vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js ./
COPY components.json* ./
COPY index.html ./

# Copy source code
COPY src ./src
COPY public ./public

# Build arguments for any compile-time config (not used, runtime config is injected)
ARG VITE_BUILD_DATE
ENV VITE_BUILD_DATE=${VITE_BUILD_DATE:-$(date -I)}

# Build the app
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config (relative to build context, i.e., /opt/gametaverns)
COPY nginx/app.conf /etc/nginx/conf.d/default.conf

# Runtime config injection script
COPY scripts/inject-config.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
