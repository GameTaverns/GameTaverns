# Build stage - compile the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build args for configuration
ARG VITE_SITE_NAME="Game Haven"
ARG VITE_SITE_DESCRIPTION="Browse and discover our collection of board games"
ARG VITE_SITE_AUTHOR="Game Haven"
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

# Feature flags
ARG VITE_FEATURE_PLAY_LOGS=true
ARG VITE_FEATURE_WISHLIST=true
ARG VITE_FEATURE_FOR_SALE=true
ARG VITE_FEATURE_MESSAGING=true
ARG VITE_FEATURE_COMING_SOON=true
ARG VITE_FEATURE_DEMO_MODE=false

# Set environment variables for build
ENV VITE_SITE_NAME=$VITE_SITE_NAME
ENV VITE_SITE_DESCRIPTION=$VITE_SITE_DESCRIPTION
ENV VITE_SITE_AUTHOR=$VITE_SITE_AUTHOR
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_FEATURE_PLAY_LOGS=$VITE_FEATURE_PLAY_LOGS
ENV VITE_FEATURE_WISHLIST=$VITE_FEATURE_WISHLIST
ENV VITE_FEATURE_FOR_SALE=$VITE_FEATURE_FOR_SALE
ENV VITE_FEATURE_MESSAGING=$VITE_FEATURE_MESSAGING
ENV VITE_FEATURE_COMING_SOON=$VITE_FEATURE_COMING_SOON
ENV VITE_FEATURE_DEMO_MODE=$VITE_FEATURE_DEMO_MODE

RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Create health check file
RUN echo '{"status":"healthy","service":"gamehaven-frontend","version":"1.0.0"}' > /usr/share/nginx/html/health.json

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
