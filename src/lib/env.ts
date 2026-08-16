export function productionEnvReport() {
  const required = [
    "DATABASE_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_APP_DOMAIN",
    "INTERNAL_API_SECRET",
  ];

  return required.map((key) => ({
    key,
    ok: Boolean(process.env[key]),
  }));
}
