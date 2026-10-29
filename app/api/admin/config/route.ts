import { adminOnly, json } from "@/lib/session";
import { readConfig, writeConfig, sheetStore } from "@/lib/sheets";
import { checkConfig } from "@/lib/validate";

export async function GET() {
  const g = await adminOnly(); if (g.res) return g.res;
  return json({ config: await readConfig(sheetStore, "draft") });
}
export async function PUT(req: Request) {
  const g = await adminOnly(); if (g.res) return g.res;
  const body = await req.json().catch(() => null), err = checkConfig(body?.config, false);
  if (err) return json({ error: err }, 400);
  await writeConfig(sheetStore, { draft: body.config });
  return json({ ok: true });
}
