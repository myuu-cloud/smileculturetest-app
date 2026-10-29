import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeScores, liveQuestions, validateAnswers, type Config } from "../lib/scoring.ts";
import cfgJson from "../lib/default-config.json" with { type: "json" };

const cfg = cfgJson as Config;
// The browser scores the quiz too; pull its functions out of public/app.html and check both give the same result.
const html = readFileSync(new URL("../public/app.html", import.meta.url), "utf8");
const grab = (name: string) => { const a = html.indexOf("function " + name + "("); let i = html.indexOf("{", a), d = 0; for (; i < html.length; i++) { if (html[i] === "{") d++; else if (html[i] === "}" && !--d) break; } return html.slice(a, i + 1); };
const client = new Function("CFG", `const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;${grab("liveQuestions")};const QS=liveQuestions();${grab("computeScores")};return{QS,computeScores};`)(cfg);

function randomAnswers(seed: number) {
  let x = seed; const rnd = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const qs = liveQuestions(cfg), ans: Record<string, number> = {}, swap: Record<string, boolean> = {};
  for (const q of qs) { const v = 1 + Math.floor(rnd() * 3); ans[q.id] = rnd() < 0.5 ? -v : v; swap[q.id] = rnd() < 0.5; }
  return { order: qs.map((q) => q.id), swap, ans };
}

test("server question ids match the browser", () => assert.deepEqual(liveQuestions(cfg).map((q) => q.id), client.QS.map((q: { id: string }) => q.id)));

test("server scoring matches the browser on 300 random quizzes (incl. ties)", () => {
  for (let k = 1; k <= 300; k++) { const a = randomAnswers(k); assert.deepEqual(computeScores(cfg, a), client.computeScores(a)); }
});

test("answers are validated at the trust boundary", () => {
  const good = randomAnswers(7);
  assert.equal(typeof validateAnswers(cfg, good), "object");
  const qid = Object.keys(good.ans)[0];
  assert.match(validateAnswers(cfg, { ...good, ans: { ...good.ans, [qid]: 9 } }) as string, /invalid/);
  assert.match(validateAnswers(cfg, { ...good, ans: { ...good.ans, [qid]: 0 } }) as string, /invalid/);
  const { [qid]: _, ...missing } = good.ans;
  assert.match(validateAnswers(cfg, { ...good, ans: missing }) as string, /unanswered/);
  assert.match(validateAnswers(cfg, { ...good, ans: { ...good.ans, hack: 3 } }) as string, /unknown/);
  assert.equal(typeof validateAnswers(cfg, null), "string");
});
