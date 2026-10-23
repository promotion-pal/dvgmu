import type { NextConfig } from "next";
import path from "path";

// Бэкенд не выставлен наружу — фронт проксирует /api на него внутри docker-сети.
// Локально по умолчанию — http://localhost:4000, в проде — имя контейнера.
const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_INTERNAL_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
