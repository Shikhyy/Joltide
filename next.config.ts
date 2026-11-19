import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a second origin (127.0.0.1) act as an independent browser identity in local tests
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
