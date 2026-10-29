import { adminOnly, json } from "@/lib/session";
import { sheetStore, tabs, sheetUrl } from "@/lib/sheets";
import { parseAttempts, usersOf, summarize } from "@/lib/attempts";

export async function GET() {
  const g = await adminOnly(); if (g.res) return g.res;
  const list = parseAttempts(await sheetStore.read(tabs().attempts));
  return json({ sheetUrl: sheetUrl(), summary: summarize(list), users: usersOf(list),
    attempts: list.map((a) => ({ attemptId: a.attempt_id, userId: a.user_id, email: a.email, name: a.display_name, attemptNumber: +a.attempt_number, startedAt: a.started_at, completedAt: a.completed_at,
      durationSeconds: +a.duration_seconds, score: +a.total_score, maxScore: +a.maximum_score, main: a.main_result, sub: a.secondary_result, version: a.quiz_version, pct: (JSON.parse(a.result_json || "{}").pct) || {} })) });
}
