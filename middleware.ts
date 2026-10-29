import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { routeDecision } from "@/lib/access";

// Server-side gate for every page; the client never decides who is an admin.
export default auth((req) => {
  const d = routeDecision(req.nextUrl.pathname, req.auth?.user?.email ?? null);
  if (d.action === "rewrite") return NextResponse.rewrite(new URL(d.to!, req.url));
  if (d.action === "redirect") return NextResponse.redirect(new URL(d.to!, req.url));
  return NextResponse.next();
});

export const config = { matcher: ["/", "/quiz", "/result", "/admin", "/admin/:path*"] };
