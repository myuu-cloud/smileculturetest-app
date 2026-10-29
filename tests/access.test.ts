import { test } from "node:test";
import assert from "node:assert/strict";
import { routeDecision, isAdminEmail } from "../lib/access.ts";
import { assertWritable } from "../lib/sheets.ts";

const admins = "hr@co.com, Boss@Co.com";
test("admin list is case-insensitive and exact", () => {
  assert.ok(isAdminEmail("boss@co.com", admins)); assert.ok(!isAdminEmail("hr@co.com.evil", admins)); assert.ok(!isAdminEmail(null, admins)); assert.ok(!isAdminEmail("x@co.com", ""));
});
test("route gate", () => {
  assert.deepEqual(routeDecision("/", null, admins), { action: "rewrite", to: "/app.html" });
  assert.equal(routeDecision("/quiz", null, admins).action, "redirect");
  assert.equal(routeDecision("/result", null, admins).action, "redirect");
  assert.equal(routeDecision("/quiz", "emp@co.com", admins).action, "rewrite");
  for (const p of ["/admin", "/admin/results", "/admin/settings"]) {
    assert.equal(routeDecision(p, null, admins).action, "redirect");
    assert.deepEqual(routeDecision(p, "emp@co.com", admins), { action: "redirect", to: "/?denied=1" });
    assert.equal(routeDecision(p, "hr@co.com", admins).action, "rewrite");
  }
  assert.equal(routeDecision("/api/me", null, admins).action, "next");
});
test("preview cannot write to the production sheet", () => {
  assert.throws(() => assertWritable({ VERCEL_ENV: "preview", PRODUCTION_SPREADSHEET_ID: "P", GOOGLE_SHEETS_SPREADSHEET_ID: "P" } as unknown as NodeJS.ProcessEnv));
  assert.doesNotThrow(() => assertWritable({ VERCEL_ENV: "preview", PRODUCTION_SPREADSHEET_ID: "P", GOOGLE_SHEETS_SPREADSHEET_ID: "T" } as unknown as NodeJS.ProcessEnv));
  assert.doesNotThrow(() => assertWritable({ VERCEL_ENV: "production", PRODUCTION_SPREADSHEET_ID: "P", GOOGLE_SHEETS_SPREADSHEET_ID: "P" } as unknown as NodeJS.ProcessEnv));
});
