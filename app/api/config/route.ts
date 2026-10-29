import { json } from "@/lib/session";
import { liveConfig } from "@/lib/live";

// Public: the published quiz holds no personal data and the start page shows its characters before sign-in.
export async function GET() {
  try { return json({ config: await liveConfig() }); } catch (e) { console.error(e); return json({ error: "config unavailable" }, 503); }
}
