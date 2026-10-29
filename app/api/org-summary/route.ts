import { me, json, denied } from "@/lib/session";
import { sheetStore, tabs } from "@/lib/sheets";
import { parseAttempts, usersOf } from "@/lib/attempts";

// Aggregate only (latest main result per person) for the "how many people are like you" panel. No names or emails.
export async function GET() {
  const u = await me(); if (!u) return denied(false);
  return json({ mains: usersOf(parseAttempts(await sheetStore.read(tabs().attempts))).map((x) => x.latest_result) });
}
