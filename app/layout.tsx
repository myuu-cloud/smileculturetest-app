// Only needed by Next for API-only routing; every page is served by the static quiz client via middleware.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
