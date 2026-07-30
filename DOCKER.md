# Docker Deployment Guide

## Build Image

```bash
docker build -t ros-app:latest .
```

## Run Locally

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/ros" \
  -e SESSION_SECRET="..." \
  -e CREDENTIAL_ENCRYPTION_KEY="..." \
  -e APP_URL="http://localhost:3000" \
  ros-app:latest
```

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase or self-hosted) |
| `DIRECT_URL` | Direct PostgreSQL URL for migrations and backups |
| `DATABASE_POOL_MAX` | Per-instance pool size; use `5` as the Vercel starting point |
| `SESSION_SECRET` | Min 32 characters for iron-session |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256-GCM key for encrypted credentials |
| `CRON_SECRET` | Min 32 characters; bearer secret for scheduled jobs |
| `APP_URL` | Public URL of the app (e.g., `https://roastery.yourco.com`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` / `SUPABASE_PRIVATE_STORAGE_BUCKET` | Public assets plus private payment proofs and raw `.alog` artifacts |
| `GOOGLE_CLIENT_ID` | OAuth client ID (if using Google login) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | Payment gateway |
| `RESEND_API_KEY` | Email delivery |
| `WA_API_KEY` / `WA_API_URL` | WhatsApp delivery (Fonnte-compatible) |

## Deploy to VPS (e.g., DigitalOcean, AWS EC2)

```bash
# On server:
docker run -d -p 3000:3000 --name ros-app --restart unless-stopped \
  -e DATABASE_URL="..." \
  -e SESSION_SECRET="..." \
  -e CREDENTIAL_ENCRYPTION_KEY="..." \
  -e APP_URL="https://your-domain.com" \
  ros-app:latest
```

## Deploy with Docker Compose (optional)

```yaml
# docker-compose.yml (optional, for full stack)
version: "3.8"
services:
  app:
    image: ros-app:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/ros
      - SESSION_SECRET=${SESSION_SECRET}
      - CREDENTIAL_ENCRYPTION_KEY=${CREDENTIAL_ENCRYPTION_KEY}
      - APP_URL=http://localhost:3000
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=ros
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

## Run Migrations

```bash
# Apply Prisma migrations:
docker run --rm \
  -e DATABASE_URL="..." \
  -v $(pwd)/prisma:/app/prisma \
  ros-app:latest \
  pnpm prisma migrate deploy
```

## Release Gate and Health Check

```bash
pnpm preflight:production
curl --fail http://localhost:3000/api/health/live
curl --fail http://localhost:3000/api/health
```

See `PRODUCTION_READINESS.md` for backup, migration, rollback, scheduled job, and smoke-test procedures.

## Image Size

~150MB (multi-stage alpine build with standalone output).
