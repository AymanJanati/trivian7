import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { environment } from "./env";
export const COOKIE = "n7_admin";
const digest = (v: string) => createHash("sha256").update(v).digest();
export function passwordMatches(value: string) {
  return timingSafeEqual(digest(value), digest(environment().password));
}
export function signAdmin(now = Date.now()) {
  const payload = String(now + 8 * 60 * 60 * 1000);
  return (
    payload +
    "." +
    createHmac("sha256", environment().secret).update(payload).digest("hex")
  );
}
export function checkAdmin(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (
    !/^\d+$/.test(payload) ||
    !signature ||
    signature.length !== 64 ||
    Number(payload) <= now ||
    Number(payload) > now + 8 * 60 * 60 * 1000
  )
    return false;
  const expected = createHmac("sha256", environment().secret)
    .update(payload)
    .digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
