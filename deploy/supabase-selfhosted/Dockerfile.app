# GameTaverns Frontend - Production Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY bun.lockb* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source
COPY . .

# Build arguments for runtime config
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG SITE_NAME

# Build the app
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY deploy/supabase-selfhosted/nginx/app.conf /etc/nginx/conf.d/default.conf

# Runtime config injection script
COPY deploy/supabase-selfhosted/scripts/inject-config.sh /docker-entrypoint.d/40-inject-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
