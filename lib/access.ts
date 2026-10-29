// Who may see what. Pure functions so middleware, APIs and tests share one rule.
export const adminList = (raw = process.env.ADMIN_EMAILS ?? "") =>
  raw.split(/[,\s;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isAdminEmail = (email: string | null | undefined, raw?: string) =>
  !!email && adminList(raw).includes(email.toLowerCase());

export type Decision = { action: "next" | "rewrite" | "redirect" | "forbid"; to?: string };

// pages are served by the single quiz client (/app.html); APIs check again on their own
export function routeDecision(path: string, email: string | null, admins?: string): Decision {
  const page = path === "/" || path === "/quiz" || path === "/result" || path === "/admin" || path.startsWith("/admin/");
  if (!page) return { action: "next" };
  if (path === "/") return { action: "rewrite", to: "/app.html" };
  if (!email) return { action: "redirect", to: "/?signin=" + encodeURIComponent(path) };
  if (path.startsWith("/admin") && !isAdminEmail(email, admins)) return { action: "redirect", to: "/?denied=1" };
  return { action: "rewrite", to: "/app.html" };
}
