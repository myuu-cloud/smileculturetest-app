import { me, json } from "@/lib/session";
import { sheetUrl } from "@/lib/sheets";

export async function GET() {
  const u = await me();
  if (!u) return json({ signedIn: false });
  return json({ signedIn: true, name: u.name, email: u.email, image: u.image, isAdmin: u.isAdmin,
    ...(u.isAdmin ? { sheetUrl: sheetUrl(), ai: !!process.env.ANTHROPIC_API_KEY } : {}) });
}
