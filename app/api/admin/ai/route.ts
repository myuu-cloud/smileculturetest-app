import { adminOnly, json } from "@/lib/session";

// Admin-only stand-in for the artifact's Claude sampling (AI-written texts, questions, character designs).
export async function POST(req: Request) {
  const g = await adminOnly(); if (g.res) return g.res;
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return json({ error: "AI is not configured" }, 501);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.prompt !== "string" || b.prompt.length > 200_000) return json({ error: "prompt required" }, 400);
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content: b.prompt }] }) });
  if (!r.ok) { console.error("anthropic", r.status, await r.text()); return json({ error: "AI request failed" }, r.status === 429 ? 429 : 502); }
  const j = await r.json();
  return json({ text: (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("") });
}
