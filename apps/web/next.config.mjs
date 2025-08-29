/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bun-template/utils'],
  experimental: {
    // Enable optimizations
    optimizeCss: true,
  },
}

export default nextConfig