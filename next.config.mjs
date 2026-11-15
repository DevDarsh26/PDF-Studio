/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, dev }) => {
    // In development mode on Windows, use in-memory caching to eliminate
    // PackFileCacheStrategy disk collisions and ENOENT *.pack.gz errors
    if (dev) {
      config.cache = {
        type: "memory",
      };
    }

    // Support WebAssembly loading
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Ignore canvas & Node builtins on client-side (PDF.js fallback)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        encoding: false,
        fs: false,
        path: false,
        stream: false,
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };

    return config;
  },
};

export default nextConfig;

