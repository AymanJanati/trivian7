import { z } from "zod";
export function normalizeName(raw: string) {
  const displayName = raw.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const length = Array.from(displayName).length;
  if (
    length < 2 ||
    length > 16 ||
    !/^[\p{L}\p{M}\p{N} _-]+$/u.test(displayName) ||
    !/[\p{L}\p{N}]/u.test(displayName)
  ) {
    throw new Error("Use 2–16 letters, numbers, spaces, _ or -. ");
  }
  return {
    displayName,
    normalizedName: displayName
      .toLocaleLowerCase("und")
      .replace(/ß/g, "ss")
      .replace(/ς/g, "σ"),
  };
}
export const nameSchema = z
  .string()
  .max(100)
  .transform((value, ctx) => {
    try {
      return normalizeName(value);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: (e as Error).message });
      return z.NEVER;
    }
  });
