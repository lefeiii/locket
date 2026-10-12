import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
export function awakeDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
export async function awakeUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}
export function hostDigest(token: unknown) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}
export function isAwakeAdmin(email?: string) {
  return Boolean(email && email.toLowerCase() === (process.env.LOCKET_ADMIN_EMAIL ?? "hellokayleec@gmail.com").trim().toLowerCase());
}
export function validNight(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}
