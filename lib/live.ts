import { readConfig, sheetStore } from "./sheets.ts";
import type { Config } from "./scoring.ts";
import fallback from "./default-config.json";

// Published quiz; before HR publishes anything it is the built-in default (same as the client's DEFAULT_CFG).
export async function liveConfig(): Promise<Config> {
  const c = await readConfig(sheetStore, "live");
  return c && Array.isArray(c.cultures) && c.cultures.length >= 2 ? c : (fallback as Config);
}
