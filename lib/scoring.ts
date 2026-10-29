// Server copy of the quiz scoring (same rules as computeScores()/liveQuestions() in public/app.html; tests/scoring.test.ts checks they agree).
export type Culture = { id: string; name?: string };
export type Question = { a: string; b: string; q?: string; optA?: string; optB?: string };
export type Config = { version?: number; perPair?: number; cultures: Culture[]; questions: Question[] };
export type Answers = { order: string[]; swap: Record<string, boolean>; ans: Record<string, number> };

const pairKey = (a: string, b: string) => (a < b ? a + "|" + b : b + "|" + a);

export function liveQuestions(cfg: Config) {
  const ids = new Set(cfg.cultures.map((c) => c.id)), N = Math.min(3, Math.max(1, +(cfg.perPair ?? 1) || 1)), cnt: Record<string, number> = {};
  return cfg.questions.filter((q) => { const k = pairKey(q.a, q.b); if (!ids.has(q.a) || !ids.has(q.b) || (cnt[k] || 0) >= N) return false; cnt[k] = (cnt[k] || 0) + 1; return true; })
    .map((q, i) => ({ ...q, id: "q" + i + "_" + pairKey(q.a, q.b) }));
}

// Trust boundary: answers come from the browser. Every live question must be answered with -3..-1 or 1..3.
export function validateAnswers(cfg: Config, x: unknown): Answers | string {
  if (!x || typeof x !== "object") return "answers missing";
  const a = x as Answers, qs = liveQuestions(cfg), ids = new Set(qs.map((q) => q.id));
  if (!a.ans || typeof a.ans !== "object" || !a.swap || typeof a.swap !== "object") return "answers malformed";
  for (const q of qs) { const v = a.ans[q.id]; if (!Number.isInteger(v) || v === 0 || Math.abs(v) > 3) return "unanswered or invalid: " + q.id; if (typeof a.swap[q.id] !== "boolean") return "swap missing: " + q.id; }
  if (Object.keys(a.ans).some((k) => !ids.has(k))) return "unknown question id";
  return { order: Array.isArray(a.order) ? a.order.filter((k) => ids.has(k)) : [], swap: Object.fromEntries(qs.map((q) => [q.id, a.swap[q.id]])), ans: Object.fromEntries(qs.map((q) => [q.id, a.ans[q.id]])) };
}

export function computeScores(cfg: Config, att: Answers) {
  const QS = liveQuestions(cfg), ids = cfg.cultures.map((c) => c.id);
  const s: Record<string, number> = {}, s3: Record<string, number> = {}, s2: Record<string, number> = {}, m: Record<string, Record<string, number>> = {};
  ids.forEach((i) => { s[i] = 0; s3[i] = 0; s2[i] = 0; m[i] = {}; ids.forEach((j) => (m[i][j] = 0)); });
  for (const q of QS) { const v = att.ans[q.id]; if (!v) continue; const sw = att.swap[q.id], left = sw ? q.b : q.a, right = sw ? q.a : q.b, win = v < 0 ? left : right, lose = win === left ? right : left, pts = Math.abs(v);
    s[win] += pts; if (pts === 3) s3[win]++; if (pts >= 2) s2[win]++; m[win][lose] += pts; m[lose][win] -= pts; }
  const max: Record<string, number> = {}; ids.forEach((i) => (max[i] = 3 * QS.filter((q) => q.a === i || q.b === i).length || 1));
  const pct: Record<string, number> = {}; ids.forEach((i) => (pct[i] = Math.round((s[i] / max[i]) * 100)));
  // tie-break inside each equal-points group: 1) head-to-head 2) "มากๆ" picks 3) "แน่ๆ"+ picks
  const groups: string[][] = []; ids.slice().sort((x, y) => pct[y] - pct[x] || s[y] - s[x]).forEach((id) => { const g = groups[groups.length - 1]; if (g && pct[g[0]] === pct[id] && s[g[0]] === s[id]) g.push(id); else groups.push([id]); });
  const key: Record<string, number[]> = {}; let tie: null | { with: string[]; by: string; full: string[] } = null;
  groups.forEach((g, gi) => { g.forEach((x) => (key[x] = [g.reduce((a, y) => a + (y === x ? 0 : m[x][y]), 0), s3[x], s2[x]]));
    g.sort((x, y) => key[y][0] - key[x][0] || key[y][1] - key[x][1] || key[y][2] - key[x][2]);
    if (gi === 0 && g.length > 1) { const a = key[g[0]], b = key[g[1]], by = a[0] !== b[0] ? "h2h" : a[1] !== b[1] ? "s3" : a[2] !== b[2] ? "s2" : "none";
      tie = { with: g.slice(1), by, full: g.slice(1).filter((x) => key[x].join() === a.join()) }; } });
  const pts: Record<string, number> = {}, full: Record<string, number> = {}; ids.forEach((i) => { pts[i] = s[i]; full[i] = max[i]; });
  return { rank: groups.flat(), pct, m, tie, pts, full };
}
