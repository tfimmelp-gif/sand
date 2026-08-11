# Multi-Tenant Link Management Platform

Phase 1 initializes the database and environment structure for a Next.js, Prisma, PostgreSQL, Redis-backed link management platform.

## Setup

1. Copy `.env.example` to `.env`.
2. Update `DATABASE_URL`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD`.
3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Create the first migration:

```bash
npm run prisma:migrate -- --name init
```

6. Seed the default super admin:

```bash
npm run db:seed
```

## Phase 1 Contents

- Prisma schema with `User`, `Domain`, `Link`, and `ClickLog`.
- Role and status enums for RBAC, domain health, and link state.
- Composite indexes for high-throughput link analytics lookups.
- Seed script for the initial `SUPER_ADMIN` account.

## Production

See [docs/production-deploy.md](docs/production-deploy.md) for the VPS Docker Compose deployment flow with Caddy On-Demand TLS.
