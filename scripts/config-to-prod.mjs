// Copy the Config tab (characters, questions, draft + live) from the TEST sheet to the PRODUCTION sheet.
// Run: npm run config:to-prod   (reads .env.local; overwrites Production's Config, never touches Attempts/Users/Summary)
import { createSign } from "node:crypto";

const e = process.env, TAB = e.GOOGLE_SHEETS_CONFIG_TAB || "Config";
const from = e.GOOGLE_SHEETS_SPREADSHEET_ID, to = e.PRODUCTION_SPREADSHEET_ID;
if (!from || !to || from === to) { console.error("ต้องตั้ง GOOGLE_SHEETS_SPREADSHEET_ID (Test) และ PRODUCTION_SPREADSHEET_ID ให้เป็นคนละชีตใน .env.local"); process.exit(1); }

const now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const head = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: e.GOOGLE_SHEETS_CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 600 });
const jwt = head + "." + createSign("RSA-SHA256").update(head).sign(e.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n"), "base64url");
const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
if (!tok.ok) { console.error("Google token request failed: " + tok.status); process.exit(1); }
const { access_token } = await tok.json();

async function api(id, path, init = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, { ...init, headers: { authorization: "Bearer " + access_token, "content-type": "application/json" } });
  if (!r.ok) throw new Error(`Sheets API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const range = (a1) => encodeURIComponent(`'${TAB}'!${a1}`);

const rows = (await api(from, `/values/${range("A:ZZ")}`)).values ?? [];
const keys = rows.map((r) => r[0]).filter(Boolean);
if (!keys.includes("live") && !keys.includes("draft")) { console.error("ชีต Test ยังไม่มีการตั้งค่าในแท็บ Config (ยังไม่เคยบันทึกในหน้า Admin) จึงไม่มีอะไรให้คัดลอก"); process.exit(1); }

const titles = ((await api(to, "?fields=sheets.properties.title")).sheets ?? []).map((s) => s.properties.title);
if (!titles.includes(TAB)) await api(to, ":batchUpdate", { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }) });
await api(to, `/values/${range("A:ZZ")}:clear`, { method: "POST", body: "{}" });
await api(to, `/values/${range("A1")}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: rows }) });
console.log(`คัดลอก Config (${keys.join(", ")}) จากชีต Test ไปชีต Production แล้ว`);
