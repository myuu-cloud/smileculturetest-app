import { test } from "node:test";
import assert from "node:assert/strict";
import { submitAttempt, parseAttempts, summarize } from "../lib/attempts.ts";
import { liveQuestions, type Config } from "../lib/scoring.ts";
import type { Store } from "../lib/sheets.ts";
import cfgJson from "../lib/default-config.json" with { type: "json" };

const cfg = cfgJson as Config;
const memStore = (): Store & { t: Record<string, string[][]> } => { const t: Record<string, string[][]> = {};
  return { t, async read(n) { return (t[n] ?? []).map((r) => [...r]); }, async append(n, rows) { (t[n] ??= []).push(...rows.map((r) => r.map(String))); }, async replace(n, rows) { t[n] = rows.map((r) => r.map(String)); } }; };
const answers = () => { const qs = liveQuestions(cfg); return { order: qs.map((q) => q.id), swap: Object.fromEntries(qs.map((q) => [q.id, false])), ans: Object.fromEntries(qs.map((q, i) => [q.id, i % 2 ? 2 : -3])) }; };
const A = { id: "g-a", email: "a@x.com", name: "User A" }, B = { id: "g-b", email: "b@x.com", name: "User B" };
const go = (s: Store, user: typeof A, attemptId: string) => submitAttempt(s, { user, attemptId, startedAt: new Date(Date.now() - 60_000).toISOString(), answers: answers(), cfg });

test("attempt numbers, idempotency and counts", async () => {
  const s = memStore();
  assert.equal((await go(s, A, "att-a-0001")).attempt.attempt_number, "1");
  assert.equal((await go(s, A, "att-a-0002")).attempt.attempt_number, "2");
  const again = await go(s, A, "att-a-0002");                       // network retry with the same attempt id
  assert.equal(again.duplicate, true);
  assert.equal((await go(s, A, "att-a-0003")).attempt.attempt_number, "3");
  assert.equal((await go(s, B, "att-b-0001")).attempt.attempt_number, "1");
  const list = parseAttempts(s.t.Attempts), sum = summarize(list);
  assert.equal(s.t.Attempts.length, 1 + 4, "header + 4 rows, the retry wrote nothing");
  assert.deepEqual([sum.totalAttempts, sum.uniqueUsers, sum.repeatUsers], [4, 2, 1]);
  assert.equal(sum.perEmail["a@x.com"], 3); assert.equal(sum.perEmail["b@x.com"], 1);
  assert.deepEqual(s.t.Users.slice(1).map((r) => [r[1], r[5]]).sort(), [["a@x.com", "3"], ["b@x.com", "1"]]);
  assert.equal(s.t.Summary[1][1], "4"); assert.equal(s.t.Summary[2][1], "2"); assert.equal(s.t.Summary[3][1], "1");
});

test("another user cannot reuse someone's attempt id", async () => {
  const s = memStore(); await go(s, A, "att-shared-1");
  await assert.rejects(go(s, B, "att-shared-1"), /another user/);
});

test("a duplicated row (lost race) is counted once", () => {
  const s = memStore(); return go(s, A, "att-dup-0001").then(() => { s.t.Attempts.push([...s.t.Attempts[1]]);
    assert.equal(summarize(parseAttempts(s.t.Attempts)).totalAttempts, 1); });
});

test("score columns come from the server, not the client", async () => {
  const s = memStore(); const r = (await go(s, A, "att-score-01")).attempt;
  assert.ok(+r.total_score > 0 && +r.total_score <= +r.maximum_score);
  assert.ok(cfg.cultures.some((c) => c.id === r.main_result));
});
