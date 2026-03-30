/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.CAPACITOR_BUILD === '1' ? { output: 'export', trailingSlash: true } : {}),
};

export default nextConfig;
