import { auth } from "@/auth";
import { isAdminEmail } from "./access.ts";

// Identity always comes from the server session, never from the request body.
export async function me() {
  const s = await auth(), u = s?.user as { id?: string; email?: string | null; name?: string | null; image?: string | null } | undefined;
  if (!u?.email || !u.id) return null;
  return { id: u.id, email: u.email.toLowerCase(), name: u.name || u.email, image: u.image || null, isAdmin: isAdminEmail(u.email) };
}
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
export const denied = (signedIn: boolean) => json({ error: signedIn ? "forbidden" : "sign-in required" }, signedIn ? 403 : 401);
export async function adminOnly() { const u = await me(); return u?.isAdmin ? { u } : { res: denied(!!u) }; }
