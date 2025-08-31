/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@template/utils'],
  experimental: {
    // Enable optimizations
    optimizeCss: true,
  },
}

export default nextConfig
