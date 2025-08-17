/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    PUPPETEER_EXECUTABLE_PATH: 'C:\\Users\\User\\.cache\\puppeteer\\chrome\\win64-139.0.7258.68\\chrome-win64\\chrome.exe',
  },
}

export default nextConfig
