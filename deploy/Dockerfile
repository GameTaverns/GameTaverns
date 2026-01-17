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

# Build the app with environment variables
ARG VITE_SITE_NAME="Game Haven"
ARG VITE_SITE_DESCRIPTION="Browse and discover our collection of board games"
ARG VITE_SITE_AUTHOR="Game Haven"
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

ENV VITE_SITE_NAME=$VITE_SITE_NAME
ENV VITE_SITE_DESCRIPTION=$VITE_SITE_DESCRIPTION
ENV VITE_SITE_AUTHOR=$VITE_SITE_AUTHOR
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
