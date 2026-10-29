import { adminOnly, json } from "@/lib/session";
import { writeConfig, sheetStore } from "@/lib/sheets";
import { checkConfig } from "@/lib/validate";

export async function POST(req: Request) {
  const g = await adminOnly(); if (g.res) return g.res;
  const body = await req.json().catch(() => null), err = checkConfig(body?.config, true);
  if (err) return json({ error: err }, 400);
  // keep the version the admin's page already applied, so their own next submit is not rejected as stale
  const v = body.config.version, live = { ...body.config, version: Number.isFinite(v) && v > 0 ? v : Date.now() };
  await writeConfig(sheetStore, { live, draft: live });
  return json({ ok: true, version: live.version });
}
