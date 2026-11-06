/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/documents': ['scripts/pdf-worker.mjs', 'node_modules/unpdf/**/*', 'node_modules/.pnpm/unpdf@*/node_modules/unpdf/**/*'],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
