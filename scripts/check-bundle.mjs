// After `next build`: fail if any secret (by value or by env name) reached files the browser can download.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const SECRET_KEYS = ["AUTH_SECRET", "GOOGLE_CLIENT_SECRET", "GOOGLE_SHEETS_PRIVATE_KEY", "GOOGLE_SHEETS_CLIENT_EMAIL", "ADMIN_EMAILS", "ANTHROPIC_API_KEY", "AUTH_GOOGLE_SECRET"];
const values = SECRET_KEYS.map((k) => process.env[k]).filter((v) => v && v.length >= 8).flatMap((v) => v.split(/[,\s]+/).filter((x) => x.length >= 8));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk(".next/static"), ...walk("public")];
const hits = [];
for (const f of files) { const t = readFileSync(f, "utf8"); for (const s of [...SECRET_KEYS, ...values]) if (t.includes(s)) hits.push(`${f}: ${SECRET_KEYS.includes(s) ? s : "<secret value>"}`); }
if (hits.length) { console.error("Secrets found in browser files:\n" + hits.join("\n")); process.exit(1); }
console.log(`OK: ${files.length} browser files, no secrets (checked ${values.length} values, ${SECRET_KEYS.length} names)`);
