# Production Deployment

This project is prepared for a single VPS using Docker Compose:

- Next.js app on port `3000` inside Docker
- PostgreSQL 16 in Docker
- Caddy on public ports `80` and `443`
- On-demand TLS for every allowed tenant domain

## 1. VPS Requirements

Use Ubuntu 22.04+ or Debian 12+ with:

```bash
docker --version
docker compose version
```

Open firewall ports:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Upload Project

From your local machine, upload the project to the VPS:

```bash
scp -r ./SAND user@YOUR_SERVER_IP:/opt/link-platform
```

Or clone/pull from Git on the VPS.

## 3. Production Environment

On the VPS:

```bash
cd /opt/link-platform
cp deploy/env.production.example .env.production
nano .env.production
```

Set:

- `APP_DOMAIN` and `NEXT_PUBLIC_APP_DOMAIN` to your platform domain, for example `yourplatform.com`
- `NEXTAUTH_URL` to `https://yourplatform.com`
- `PUBLIC_SERVER_IP` to the VPS public IP
- `CADDY_ADMIN_EMAIL` to your admin email
- strong secrets for `NEXTAUTH_SECRET`, `INTERNAL_API_SECRET`, and `POSTGRES_PASSWORD`
- real Upstash REST URL/token

Make sure `DATABASE_URL` uses the same Postgres username/password as the other Postgres values.

## 4. DNS

For the platform dashboard domain:

```text
yourplatform.com  A  YOUR_SERVER_IP
```

For each tenant root domain:

```text
rectfairways.com  A  YOUR_SERVER_IP
```

For each tenant subdomain:

```text
go.rectfairways.com  CNAME  yourplatform.com
```

Then add the domain in the Admin Domain Pool and click `Check DNS`.

## 5. Start Production

On the VPS:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

If you keep the env file somewhere else, set `APP_ENV_FILE` to that path before running Compose.

Seed the first accounts:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm app npm run db:seed
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app caddy
```

## 6. Verify

Open:

```text
https://yourplatform.com/admin/login
https://yourplatform.com/login
```

Then:

1. Add `rectfairways.com` in Domain Pool.
2. Click `Check DNS`.
3. Assign it to a tenant.
4. Create or regenerate a prefix.
5. Open `https://rectfairways.com/prefix/index.html`.

If Caddy accepts the domain and the app finds the link, the assigned preset `index.html` renders.
