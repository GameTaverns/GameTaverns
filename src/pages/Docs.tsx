import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, Settings, Server, Terminal, Copy, Check } from "lucide-react";
import { toast } from "sonner";

// Documentation content
const DEPLOYMENT_CONTENT = `# Game Haven Self-Hosted Deployment Guide

This guide walks you through deploying Game Haven on your own Linux server with a fully self-hosted Supabase backend.

## Prerequisites

- **Linux server** (Ubuntu 20.04+ recommended)
- **Docker** 20.10+ and **Docker Compose** v2+
- **4GB+ RAM** (8GB recommended)
- **20GB+ disk space**
- **Domain name** (optional, but recommended for production)

## Quick Start

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/game-haven.git
cd game-haven

# Make deploy script executable
chmod +x deploy/deploy.sh

# Run full setup
./deploy/deploy.sh setup
\`\`\`

The script will:
1. Check requirements
2. Generate secure credentials
3. Prompt for site configuration
4. Initialize the database with all migrations
5. Start the Docker stack

## Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 80/443 | Game Haven web app |
| Kong | 8000/8443 | Supabase API Gateway |
| Studio | 3000 | Supabase Admin UI |
| PostgreSQL | 5432 | Database (internal) |

## Post-Installation

### 1. Create Admin User

1. Visit your site and create an account via signup
2. Access Supabase Studio at \`http://localhost:3000\`
3. Navigate to Table Editor → \`user_roles\`
4. Insert a row with your \`user_id\` and \`role\` = \`admin\`

### 2. Configure Site Settings

In Studio, update the \`site_settings\` table:

| Key | Value |
|-----|-------|
| \`contact_email\` | Your contact email |
| \`show_for_sale\` | \`true\` or \`false\` |

## Security Checklist

- [ ] Change all default passwords
- [ ] Use HTTPS in production
- [ ] Configure firewall (only expose 80/443)
- [ ] Keep PostgreSQL port internal only
- [ ] Set up automated backups
- [ ] Monitor disk usage
`;

const CONFIGURATION_CONTENT = `# Site Configuration Guide

This application uses environment variables for branding and configuration.

## Environment Variables

### Required (for custom branding)

\`\`\`env
# Site name displayed in header, sidebar, and browser tab
VITE_SITE_NAME="Your Game Library"

# Description for SEO meta tags
VITE_SITE_DESCRIPTION="Browse and discover our collection of board games."

# Author name for meta tags
VITE_SITE_AUTHOR="Your Name"
\`\`\`

### Required (for backend)

\`\`\`env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"
\`\`\`

## Supabase Secrets (Edge Functions)

| Secret | Required | Description |
|--------|----------|-------------|
| \`SUPABASE_URL\` | Yes | Supabase project URL |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Yes | Service role key for admin operations |
| \`PII_ENCRYPTION_KEY\` | Yes | 32-byte hex key for encrypting personal data |
| \`TURNSTILE_SECRET_KEY\` | Yes | Cloudflare Turnstile secret for anti-spam |
| \`SMTP_HOST\` | Yes | SMTP server hostname |
| \`SMTP_PORT\` | Yes | SMTP port (usually 587 or 465) |
| \`SMTP_USER\` | Yes | SMTP username |
| \`SMTP_PASS\` | Yes | SMTP password |
| \`SMTP_FROM\` | Yes | From email address |

## Theme Customization

Colors and theming are controlled in:
- \`src/index.css\` - CSS variables for colors
- \`tailwind.config.ts\` - Tailwind theme configuration
`;

const DOCKER_COMPOSE_CONTENT = `version: "3.8"

# Game Haven Self-Hosted Stack
services:
  frontend:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    container_name: gamehaven-frontend
    ports:
      - "\${FRONTEND_PORT:-80}:80"
    environment:
      - VITE_SITE_NAME=\${VITE_SITE_NAME:-Game Haven}
      - VITE_SUPABASE_URL=http://kong:8000
      - VITE_SUPABASE_PUBLISHABLE_KEY=\${ANON_KEY}
    depends_on:
      - kong
    restart: unless-stopped
    networks:
      - gamehaven

  kong:
    image: kong:2.8.1
    container_name: supabase-kong
    ports:
      - "\${KONG_HTTP_PORT:-8000}:8000"
    # ... additional configuration
    networks:
      - gamehaven

  auth:
    image: supabase/gotrue:v2.143.0
    container_name: supabase-auth
    environment:
      GOTRUE_DB_DATABASE_URL: postgres://...@db:5432/\${POSTGRES_DB}
      GOTRUE_JWT_SECRET: \${JWT_SECRET}
      # ... additional configuration
    networks:
      - gamehaven

  rest:
    image: postgrest/postgrest:v12.0.1
    container_name: supabase-rest
    environment:
      PGRST_DB_URI: postgres://...@db:5432/\${POSTGRES_DB}
      PGRST_JWT_SECRET: \${JWT_SECRET}
    networks:
      - gamehaven

  db:
    image: supabase/postgres:15.1.0.147
    container_name: supabase-db
    environment:
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    volumes:
      - ./volumes/db/data:/var/lib/postgresql/data
    networks:
      - gamehaven

  # ... additional services (realtime, storage, functions, studio)

networks:
  gamehaven:
    driver: bridge
`;

const DEPLOY_SCRIPT_CONTENT = `#!/bin/bash

#######################################
# Game Haven Self-Hosted Deployment Script
#######################################

set -e

print_header() {
    echo "========================================"
    echo "$1"
    echo "========================================"
}

# Check for required tools
check_requirements() {
    print_header "Checking Requirements"
    
    for cmd in docker openssl; do
        if ! command -v $cmd &> /dev/null; then
            echo "Missing: $cmd"
            exit 1
        fi
    done
    
    echo "✓ All requirements met"
}

# Generate secure random strings
generate_secret() {
    openssl rand -hex 32
}

# Create .env file with user input
create_env_file() {
    print_header "Creating Environment Configuration"
    
    read -p "Site name [Game Haven]: " site_name
    site_name=\${site_name:-"Game Haven"}
    
    read -p "Domain [localhost]: " domain
    domain=\${domain:-"localhost"}
    
    # Generate secrets
    local postgres_password=$(generate_secret)
    local jwt_secret=$(openssl rand -base64 64)
    local pii_key=$(generate_secret)
    
    cat > deploy/.env << EOF
VITE_SITE_NAME="\${site_name}"
SITE_URL=http://\${domain}
POSTGRES_PASSWORD=\${postgres_password}
JWT_SECRET=\${jwt_secret}
PII_ENCRYPTION_KEY=\${pii_key}
EOF

    echo "✓ Configuration created"
}

# Main commands
case "\${1:-setup}" in
    setup)
        check_requirements
        create_env_file
        docker compose up -d
        ;;
    start)
        docker compose up -d
        ;;
    stop)
        docker compose down
        ;;
    *)
        echo "Usage: $0 [setup|start|stop]"
        ;;
esac
`;

const ENV_EXAMPLE_CONTENT = `# Environment template for Game Haven
# Copy to .env and fill in values

###################################
# Site Branding
###################################
VITE_SITE_NAME="Game Haven"
VITE_SITE_DESCRIPTION="Browse and discover our collection of board games"
VITE_SITE_AUTHOR="Game Haven"

###################################
# Domain Configuration
###################################
SITE_URL=http://localhost
API_EXTERNAL_URL=http://localhost:8000

###################################
# Ports
###################################
FRONTEND_PORT=80
KONG_HTTP_PORT=8000
POSTGRES_PORT=5432
STUDIO_PORT=3000

###################################
# Database (generate unique values!)
###################################
# Generate with: openssl rand -hex 32
POSTGRES_PASSWORD=your-super-secret-password
POSTGRES_DB=postgres

###################################
# JWT / Authentication
###################################
# Generate with: openssl rand -base64 64
JWT_SECRET=your-jwt-secret

###################################
# PII Encryption
###################################
# Generate with: openssl rand -hex 32
PII_ENCRYPTION_KEY=

###################################
# SMTP Configuration
###################################
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

###################################
# Cloudflare Turnstile
###################################
TURNSTILE_SECRET_KEY=
`;

// File definitions for download
const FILES = [
  { name: "DEPLOYMENT.md", content: DEPLOYMENT_CONTENT, type: "markdown" },
  { name: "CONFIGURATION.md", content: CONFIGURATION_CONTENT, type: "markdown" },
  { name: "docker-compose.yml", content: DOCKER_COMPOSE_CONTENT, type: "yaml" },
  { name: "deploy.sh", content: DEPLOY_SCRIPT_CONTENT, type: "bash" },
  { name: ".env.example", content: ENV_EXAMPLE_CONTENT, type: "env" },
];

function CodeBlock({ content, language }: { content: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <ScrollArea className="h-[500px] w-full rounded-md border bg-muted/50">
        <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
          <code>{content}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

function downloadAllAsZip() {
  // Create a simple combined file since we can't use JSZip without adding dependency
  const combined = FILES.map(f => 
    `${"=".repeat(60)}\n${f.name}\n${"=".repeat(60)}\n\n${f.content}\n\n`
  ).join("\n");
  
  downloadFile("game-haven-deployment-files.txt", combined);
}

export default function Docs() {
  return (
    <Layout>
      <div className="container max-w-5xl py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Deployment Documentation</h1>
            <p className="text-muted-foreground mt-1">
              Everything you need to self-host Game Haven
            </p>
          </div>
          <Button onClick={downloadAllAsZip} className="gap-2">
            <Download className="h-4 w-4" />
            Download All Files
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Quick Start
            </CardTitle>
            <CardDescription>
              Deploy with a single command
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm">
              <p className="text-muted-foreground"># Clone and deploy</p>
              <p>git clone https://github.com/your-username/game-haven.git</p>
              <p>cd game-haven</p>
              <p>chmod +x deploy/deploy.sh</p>
              <p className="text-primary font-semibold">./deploy/deploy.sh setup</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="deployment" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="deployment" className="gap-1">
              <FileText className="h-4 w-4 hidden sm:inline" />
              <span>Guide</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1">
              <Settings className="h-4 w-4 hidden sm:inline" />
              <span>Config</span>
            </TabsTrigger>
            <TabsTrigger value="docker" className="gap-1">
              <Server className="h-4 w-4 hidden sm:inline" />
              <span>Docker</span>
            </TabsTrigger>
            <TabsTrigger value="script" className="gap-1">
              <Terminal className="h-4 w-4 hidden sm:inline" />
              <span>Script</span>
            </TabsTrigger>
            <TabsTrigger value="env" className="gap-1">
              <FileText className="h-4 w-4 hidden sm:inline" />
              <span>.env</span>
            </TabsTrigger>
          </TabsList>

          {FILES.map((file, index) => (
            <TabsContent 
              key={file.name} 
              value={["deployment", "config", "docker", "script", "env"][index]}
              className="mt-4"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-lg">{file.name}</CardTitle>
                    <CardDescription>
                      {index === 0 && "Complete deployment walkthrough"}
                      {index === 1 && "Environment variables and customization"}
                      {index === 2 && "Docker Compose stack definition"}
                      {index === 3 && "Automated setup script"}
                      {index === 4 && "Environment variable template"}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadFile(file.name, file.content)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  <CodeBlock content={file.content} language={file.type} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>File Structure</CardTitle>
            <CardDescription>
              Files included in the deployment package
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm space-y-1 bg-muted p-4 rounded-lg">
              <p>├── DEPLOYMENT.md              <span className="text-muted-foreground"># Full deployment guide</span></p>
              <p>├── CONFIGURATION.md           <span className="text-muted-foreground"># Configuration reference</span></p>
              <p>└── deploy/</p>
              <p>    ├── docker-compose.yml     <span className="text-muted-foreground"># Full Docker stack</span></p>
              <p>    ├── Dockerfile             <span className="text-muted-foreground"># Frontend container</span></p>
              <p>    ├── nginx.conf             <span className="text-muted-foreground"># Web server config</span></p>
              <p>    ├── deploy.sh              <span className="text-muted-foreground"># Automated setup script</span></p>
              <p>    ├── .env.example           <span className="text-muted-foreground"># Environment template</span></p>
              <p>    └── volumes/kong/kong.yml  <span className="text-muted-foreground"># API gateway config</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
