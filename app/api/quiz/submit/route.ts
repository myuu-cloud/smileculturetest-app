import { me, json, denied } from "@/lib/session";
import { sheetStore } from "@/lib/sheets";
import { liveConfig } from "@/lib/live";
import { validateAnswers, computeScores } from "@/lib/scoring";
import { submitAttempt } from "@/lib/attempts";

const ID = /^[A-Za-z0-9-]{8,64}$/;

export async function POST(req: Request) {
  const u = await me(); if (!u) return denied(false);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.attemptId !== "string" || !ID.test(b.attemptId)) return json({ error: "attemptId required" }, 400);
  const cfg = await liveConfig();
  if (String(b.version ?? "") !== String(cfg.version ?? "")) return json({ error: "quiz updated", code: "stale" }, 409);
  const answers = validateAnswers(cfg, b.answers);
  if (typeof answers === "string") return json({ error: answers }, 400);
  try {
    const r = await submitAttempt(sheetStore, { user: { id: u.id, email: u.email, name: u.name }, attemptId: b.attemptId, startedAt: String(b.startedAt ?? ""), answers, cfg });
    const sc = r.duplicate ? JSON.parse(r.attempt.result_json) : computeScores(cfg, answers);
    return json({ ok: true, duplicate: r.duplicate, attemptNumber: +r.attempt.attempt_number, result: { rank: sc.rank, pct: sc.pct } });
  } catch (e) { const st = (e as { status?: number }).status; console.error(e); return json({ error: st === 409 ? "conflict" : "could not save" }, st || 503); }
}
