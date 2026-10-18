import "server-only";
export class ConfigurationError extends Error {}
export function environment() {
  const demo = process.env.DEMO_MODE === "true";
  if (demo && process.env.VERCEL)
    throw new ConfigurationError(
      "Demo mode is local only. Connect Neon and disable DEMO_MODE on Vercel.",
    );
  if (!demo) {
    if (!process.env.DATABASE_URL)
      throw new ConfigurationError(
        "DATABASE_URL is missing. Connect Neon or explicitly enable local DEMO_MODE=true.",
      );
    if (
      (process.env.ADMIN_PASSWORD?.length ?? 0) < 12 ||
      (process.env.SESSION_SIGNING_SECRET?.length ?? 0) < 32
    )
      throw new ConfigurationError(
        "Set ADMIN_PASSWORD (12+ characters) and SESSION_SIGNING_SECRET (32+ characters).",
      );
    if (
      process.env.VERCEL_ENV === "preview" &&
      process.env.PREVIEW_DATABASE_ISOLATED !== "true"
    )
      throw new ConfigurationError(
        "Preview requires an isolated Neon branch and PREVIEW_DATABASE_ISOLATED=true.",
      );
  }
  return {
    demo,
    password: process.env.ADMIN_PASSWORD || "local-arcade-demo",
    secret:
      process.env.SESSION_SIGNING_SECRET ||
      "local-demo-secret-never-for-production-use",
  };
}
