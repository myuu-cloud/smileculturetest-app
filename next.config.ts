import type { NextConfig } from "next";
const config: NextConfig = {
  // the quiz client is one static page; keep it out of the browser cache so a deploy is picked up at once
  async headers() { return [{ source: "/app.html", headers: [{ key: "Cache-Control", value: "no-store" }] }]; },
};
export default config;
