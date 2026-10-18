import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
it("rejects session-lock migrations over a pooled Neon URL without a direct connection", () => {
  const outcome = spawnSync(process.execPath, ["scripts/prepare-build.mjs"], {
    env: {
      ...process.env,
      VERCEL: "1",
      VERCEL_ENV: "production",
      DEMO_MODE: "false",
      DATABASE_URL:
        "postgresql://test:test@ep-test-pooler.eu-central-1.aws.neon.tech/neondb",
      DATABASE_URL_UNPOOLED: "",
      POSTGRES_URL_NON_POOLING: "",
      ADMIN_PASSWORD: "test-password-long-enough",
      SESSION_SIGNING_SECRET: "test-secret-at-least-thirty-two-characters",
    },
    encoding: "utf8",
  });
  expect(outcome.status).not.toBe(0);
  expect(outcome.stderr).toContain("Migrations need DATABASE_URL_UNPOOLED");
});
it("fails production setup without a database instead of falling back to demo", () => {
  const outcome = spawnSync(process.execPath, ["scripts/prepare-build.mjs"], {
    env: {
      ...process.env,
      VERCEL: "1",
      VERCEL_ENV: "production",
      DEMO_MODE: "false",
      DATABASE_URL: "",
      ADMIN_PASSWORD: "",
      SESSION_SIGNING_SECRET: "",
    },
    encoding: "utf8",
  });
  expect(outcome.status).not.toBe(0);
  expect(outcome.stderr).toContain("DATABASE_URL missing");
});
it("refuses an explicitly enabled demo on Vercel", () => {
  const outcome = spawnSync(process.execPath, ["scripts/prepare-build.mjs"], {
    env: {
      ...process.env,
      VERCEL: "1",
      VERCEL_ENV: "production",
      DEMO_MODE: "true",
    },
    encoding: "utf8",
  });
  expect(outcome.status).not.toBe(0);
  expect(outcome.stderr).toContain("DEMO_MODE is local only");
});
