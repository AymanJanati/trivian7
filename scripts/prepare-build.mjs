import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
const demo = process.env.DEMO_MODE === "true";
if (demo && process.env.VERCEL)
  throw new Error(
    "DEMO_MODE is local only. Disable it and connect Neon before deploying.",
  );
if (demo) {
  console.log(
    "Local DEMO MODE: no production database; scores are not shared.",
  );
  process.exit(0);
}
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL missing. Connect Vercel Marketplace Neon, or explicitly enable DEMO_MODE=true locally.",
  );
if (
  (process.env.ADMIN_PASSWORD?.length ?? 0) < 12 ||
  (process.env.SESSION_SIGNING_SECRET?.length ?? 0) < 32
)
  throw new Error(
    "Provide ADMIN_PASSWORD (12+ chars) and SESSION_SIGNING_SECRET (32+ chars).",
  );
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.PREVIEW_DATABASE_ISOLATED !== "true"
)
  throw new Error(
    "Preview migrations require an isolated Neon branch and PREVIEW_DATABASE_ISOLATED=true.",
  );
const { Pool, neonConfig } = await import("@neondatabase/serverless");
neonConfig.webSocketConstructor = (await import("ws")).default;
const { drizzle } = await import("drizzle-orm/neon-serverless");
const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});
const client = await pool.connect();
try {
  await client.query("SET lock_timeout = '60s'");
  await client.query("SELECT pg_advisory_lock(71071337)");
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Checked-in Drizzle migrations applied successfully.");
} finally {
  await client.query("SELECT pg_advisory_unlock(71071337)").catch(() => {});
  client.release();
  await pool.end();
}
