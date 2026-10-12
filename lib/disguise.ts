export const DISGUISE_KEY = "locket.disguise.v1";
export type DisguiseSettings = { salt: string; hash: string; ownerId: string; failures: number; retryAt: number };
export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 210000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
}
export function readDisguise(): DisguiseSettings | null {
  const raw = localStorage.getItem(DISGUISE_KEY);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value.salt || !value.hash || !value.ownerId) throw new Error("Invalid disguise settings");
  return value;
}
