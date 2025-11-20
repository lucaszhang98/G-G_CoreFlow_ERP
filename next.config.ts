import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 确保使用 Node.js 运行时，不使用 Edge Runtime
  // 这样可以避免 Prisma 原生模块在 Edge 环境中不被支持的问题
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
