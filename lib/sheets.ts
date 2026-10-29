import { createSign } from "node:crypto";

// Google Sheets REST API (v4) with a service account; server-only. No SDK: one signed JWT + fetch.
export interface Store {
  read(tab: string): Promise<string[][]>;
  append(tab: string, rows: (string | number)[][]): Promise<void>;
  replace(tab: string, rows: (string | number)[][]): Promise<void>;
}

const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing env ${k}`); return v; };
export const tabs = () => ({
  attempts: process.env.GOOGLE_SHEETS_ATTEMPTS_TAB || "Attempts",
  users: process.env.GOOGLE_SHEETS_USERS_TAB || "Users",
  summary: process.env.GOOGLE_SHEETS_SUMMARY_TAB || "Summary",
  config: process.env.GOOGLE_SHEETS_CONFIG_TAB || "Config",
});

// Preview/dev must never write to the production sheet (set PRODUCTION_SPREADSHEET_ID to arm this check).
export function assertWritable(env = process.env) {
  const prod = env.PRODUCTION_SPREADSHEET_ID, id = env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (env.VERCEL_ENV !== "production" && prod && id === prod) throw new Error("Refusing to write: this non-production deployment points at the production spreadsheet");
}

let cached: { token: string; exp: number } | null = null;
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000), b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: need("GOOGLE_SHEETS_CLIENT_EMAIL"), scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = createSign("RSA-SHA256").update(head).sign(need("GOOGLE_SHEETS_PRIVATE_KEY").replace(/\\n/g, "\n"), "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + sig }) });
  if (!r.ok) throw new Error("Google token request failed: " + r.status);
  const j = await r.json(); cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }; return cached.token;
}

async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${need("GOOGLE_SHEETS_SPREADSHEET_ID")}${path}`, { ...init, headers: { authorization: "Bearer " + (await accessToken()), "content-type": "application/json" } });
  if (!r.ok) throw new Error(`Sheets API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

let known: Set<string> | null = null;
async function ensureTab(tab: string) {
  if (!known) known = new Set(((await api("?fields=sheets.properties.title")).sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title));
  if (known.has(tab)) return;
  await api(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
  known.add(tab);
}
const range = (tab: string, a1 = "A:ZZ") => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${a1}`);

export const sheetStore: Store = {
  async read(tab) { await ensureTab(tab); return (await api(`/values/${range(tab)}?majorDimension=ROWS`)).values ?? []; },
  async append(tab, rows) { assertWritable(); await ensureTab(tab);
    await api(`/values/${range(tab, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: rows }) }); },
  async replace(tab, rows) { assertWritable(); await ensureTab(tab);
    await api(`/values/${range(tab)}:clear`, { method: "POST", body: "{}" });
    if (rows.length) await api(`/values/${range(tab, "A1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: rows }) }); },
};

export const sheetUrl = () => process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}/edit` : null;

// Quiz configuration (live + draft) lives in the Config tab: one row per key, JSON split over cells (a cell holds max 50,000 chars).
const CHUNK = 45_000;
export async function readConfig(store: Store, key: "live" | "draft") {
  const row = (await store.read(tabs().config)).find((r) => r[0] === key);
  if (!row) return null;
  try { return JSON.parse(row.slice(1).join("")); } catch { return null; }
}
export async function writeConfig(store: Store, entries: Partial<Record<"live" | "draft", unknown>>) {
  const rows = (await store.read(tabs().config)).filter((r) => r[0] && !(r[0] in entries));
  for (const [k, v] of Object.entries(entries)) { const s = JSON.stringify(v), parts: string[] = []; for (let i = 0; i < s.length; i += CHUNK) parts.push(s.slice(i, i + CHUNK)); rows.push([k, ...parts]); }
  await store.replace(tabs().config, rows);
}
