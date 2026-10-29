import type { Store } from "./sheets.ts";
import { tabs } from "./sheets.ts";
import { computeScores, type Answers, type Config } from "./scoring.ts";

export const ATTEMPT_HEADERS = ["submission_id","attempt_id","user_id","email","display_name","attempt_number","started_at","completed_at","duration_seconds","total_score","maximum_score","main_result","secondary_result","answers_json","result_json","quiz_version","status","created_at"] as const;
export const USER_HEADERS = ["user_id","email","display_name","first_attempt_at","latest_attempt_at","total_attempts","latest_result","latest_score","highest_score"] as const;
export type Attempt = Record<(typeof ATTEMPT_HEADERS)[number], string>;
export type Identity = { id: string; email: string; name: string };

// Attempts is the source of truth; Users and Summary are rebuilt from it. Duplicate attempt_ids (a lost race) count once.
export function parseAttempts(rows: string[][]): Attempt[] {
  const [head, ...body] = rows; if (!head) return [];
  const seen = new Set<string>(), out: Attempt[] = [];
  for (const r of body) { const o = Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])) as Attempt; if (!o.attempt_id || seen.has(o.attempt_id) || o.status !== "completed") continue; seen.add(o.attempt_id); out.push(o); }
  return out;
}

export function usersOf(list: Attempt[]) {
  const by = new Map<string, Attempt[]>(); for (const a of list) by.set(a.user_id, [...(by.get(a.user_id) ?? []), a]);
  return [...by.values()].map((L) => { L.sort((x, y) => x.completed_at.localeCompare(y.completed_at)); const last = L[L.length - 1];
    return { user_id: last.user_id, email: last.email, display_name: last.display_name, first_attempt_at: L[0].completed_at, latest_attempt_at: last.completed_at, total_attempts: L.length, latest_result: last.main_result, latest_score: +last.total_score, highest_score: Math.max(...L.map((a) => +a.total_score)) }; });
}

export function summarize(list: Attempt[]) {
  const users = usersOf(list), n = list.length, u = users.length, rep = users.filter((x) => x.total_attempts > 1).length;
  const count = (f: (a: Attempt) => string) => list.reduce<Record<string, number>>((o, a) => ((o[f(a)] = (o[f(a)] || 0) + 1), o), {});
  const perCulture = count((a) => a.main_result), top = Object.entries(perCulture).sort((a, b) => b[1] - a[1])[0];
  return { totalAttempts: n, uniqueUsers: u, repeatUsers: rep, repeatPct: u ? Math.round((rep / u) * 1000) / 10 : 0, avgAttemptsPerUser: u ? Math.round((n / u) * 100) / 100 : 0,
    avgScorePct: n ? Math.round(list.reduce((s, a) => s + (+a.total_score / (+a.maximum_score || 1)) * 100, 0) / n * 10) / 10 : 0,
    mostCommonResult: top ? top[0] : "", perDay: count((a) => a.completed_at.slice(0, 10)), perCulture, perEmail: count((a) => a.email) };
}

export function summaryRows(s: ReturnType<typeof summarize>, names: Record<string, string> = {}) {
  const t = (title: string, o: Record<string, number>, label = (k: string) => k) => [[], [title, "count"], ...Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [label(k), v])];
  return [["metric", "value"], ["Total completed attempts", s.totalAttempts], ["Unique users", s.uniqueUsers], ["Repeat users", s.repeatUsers], ["Repeat-user percentage", s.repeatPct],
    ["Average attempts per user", s.avgAttemptsPerUser], ["Average score (% of main culture)", s.avgScorePct], ["Most common result", names[s.mostCommonResult] || s.mostCommonResult], ["Updated at", new Date().toISOString()],
    ...t("Attempts per day", Object.fromEntries(Object.entries(s.perDay).sort())), ...t("Attempts per Culture", s.perCulture, (k) => names[k] || k), ...t("Attempts per email", s.perEmail)] as (string | number)[][];
}

// Idempotent: the browser creates attemptId when the quiz starts and reuses it on every retry.
// shortcut: attempt_number is count+1 at write time; two simultaneous submits by the SAME user with DIFFERENT attempt ids could share a number (counts stay right because they come from rows). Upgrade to a KV lock if that matters.
export async function submitAttempt(store: Store, p: { user: Identity; attemptId: string; startedAt: string; answers: Answers; cfg: Config; now?: Date }) {
  const T = tabs(), rows = await store.read(T.attempts), list = parseAttempts(rows);
  const dup = list.find((a) => a.attempt_id === p.attemptId);
  if (dup) { if (dup.user_id !== p.user.id) throw Object.assign(new Error("attempt id belongs to another user"), { status: 409 }); return { attempt: dup, duplicate: true }; }
  const now = p.now ?? new Date(), sc = computeScores(p.cfg, p.answers), main = sc.rank[0], start = new Date(p.startedAt);
  const startedOk = !isNaN(+start) && +start <= +now ? start : now;
  const a: Attempt = { submission_id: crypto.randomUUID(), attempt_id: p.attemptId, user_id: p.user.id, email: p.user.email, display_name: p.user.name,
    attempt_number: String(list.filter((x) => x.user_id === p.user.id).length + 1), started_at: startedOk.toISOString(), completed_at: now.toISOString(),
    duration_seconds: String(Math.round((+now - +startedOk) / 1000)), total_score: String(sc.pts[main]), maximum_score: String(sc.full[main]), main_result: main, secondary_result: sc.rank[1] || main,
    answers_json: JSON.stringify(p.answers), result_json: JSON.stringify({ rank: sc.rank, pct: sc.pct, pts: sc.pts, full: sc.full, tie: sc.tie, m: sc.m }), quiz_version: String(p.cfg.version ?? ""), status: "completed", created_at: now.toISOString() };
  if (!rows.length) await store.append(T.attempts, [[...ATTEMPT_HEADERS]]);
  await store.append(T.attempts, [ATTEMPT_HEADERS.map((h) => a[h])]);
  const all = [...list, a], names = Object.fromEntries(p.cfg.cultures.map((c) => [c.id, c.name || c.id]));
  await store.replace(T.users, [[...USER_HEADERS], ...usersOf(all).map((x) => USER_HEADERS.map((h) => x[h]))]);
  await store.replace(T.summary, summaryRows(summarize(all), names));
  return { attempt: a, duplicate: false };
}
