import { me, json, denied } from "@/lib/session";
import { sheetStore, tabs } from "@/lib/sheets";
import { parseAttempts } from "@/lib/attempts";

// The signed-in user's own attempts only.
export async function GET() {
  const u = await me(); if (!u) return denied(false);
  const mine = parseAttempts(await sheetStore.read(tabs().attempts)).filter((a) => a.user_id === u.id)
    .map((a) => ({ attemptNumber: +a.attempt_number, completedAt: a.completed_at, version: a.quiz_version, result: JSON.parse(a.result_json || "{}") }));
  return json({ attempts: mine });
}
