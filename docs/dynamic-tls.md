# Dynamic Automated TLS

Use Caddy On-Demand TLS when users bring their own domains, such as `userbrand.com` or `links.userbrand.com`.

The TLS flow is:

```text
Visitor -> Caddy reverse proxy -> /api/domains/check-allowed -> Next.js + PostgreSQL
```

Caddy calls:

```text
GET /api/domains/check-allowed?domain=userbrand.com
```

The endpoint returns `200 OK` only when the domain exists in the `Domain` table with status `ACTIVE` or `PENDING`. Caddy blocks certificate issuance for `FAILED`, unknown, or invalid domains.

## Production Caddy

Use [deploy/Caddyfile](../deploy/Caddyfile) on the production server and replace:

```text
your-admin-email@yourplatform.com
```

with the administrator email for ACME certificate notices.

Set these production environment values before testing real domains:

```text
NEXTAUTH_URL=https://yourplatform.com
NEXT_PUBLIC_APP_DOMAIN=yourplatform.com
PUBLIC_SERVER_IP=<your-production-server-ip>
PLATFORM_CNAME_TARGET=yourplatform.com
```

For each owned root domain, create an `A` record pointing to `PUBLIC_SERVER_IP`.
For each owned subdomain, create either an `A` record pointing to `PUBLIC_SERVER_IP` or a `CNAME` pointing to `PLATFORM_CNAME_TARGET`.

## Nginx Alternative

Use [deploy/nginx-wildcard.conf](../deploy/nginx-wildcard.conf) only when users receive subdomains of a domain you own.

Rule of thumb:

- Caddy On-Demand TLS: user-owned external domains.
- Nginx wildcard TLS: platform-owned subdomains only.
