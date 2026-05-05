/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid PackFileCacheStrategy rename/ENOENT races when several dev servers touch the same `.next`
  // or when antivirus/indexers lock cache files (Windows). Slower incremental compiles, stabler dev.
  webpack: (config, { dev }) => {
    if (dev) config.cache = false;
    return config;
  },
};
module.exports = nextConfig;
