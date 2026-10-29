// Shape check for configs saved by admins (they are trusted, but a broken publish would break every employee's quiz).
export function checkConfig(c: unknown, publish: boolean): string | null {
  if (!c || typeof c !== "object") return "config missing";
  const x = c as { cultures?: unknown; questions?: unknown };
  if (!Array.isArray(x.cultures) || !Array.isArray(x.questions)) return "cultures and questions must be arrays";
  if (JSON.stringify(c).length > 2_000_000) return "config too large";
  if (!publish) return null;
  if (x.cultures.length < 3 || x.cultures.length > 20) return "need 3-20 cultures";
  if (x.cultures.some((k: { id?: unknown; name?: unknown }) => typeof k?.id !== "string" || typeof k?.name !== "string" || !k.name)) return "every culture needs id and name";
  return null;
}
