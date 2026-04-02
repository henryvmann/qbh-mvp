// Webpack loader for Capacitor static export builds.
// API routes use force-dynamic for Vercel, but the native app calls Vercel directly —
// so we strip force-dynamic from API routes to allow next export to succeed.
module.exports = function stripForceDynamic(source) {
  return source.replace(
    /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/g,
    "export const dynamic = 'force-static'"
  );
};
