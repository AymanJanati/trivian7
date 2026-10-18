import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
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
