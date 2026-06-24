/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Slim, self-contained server bundle for the Docker image.
  output: "standalone",
  // No eslint config is shipped; don't let `next build` block on it.
  eslint: { ignoreDuringBuilds: true },
  // Proxy API + WS to the backend in dev so the dashboard uses same-origin paths.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
