/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.CAPACITOR_BUILD === '1' ? { output: 'export', trailingSlash: true } : {}),
  // pdf-parse ships a debug harness that reads test PDFs from disk at
  // import time, which Turbopack can't statically bundle. Keeping it
  // external means it's required at runtime from node_modules.
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'capacitor://localhost' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
};

export default nextConfig;
