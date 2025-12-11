import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 确保使用 Node.js 运行时，不使用 Edge Runtime
  // 这样可以避免 Prisma 原生模块在 Edge 环境中不被支持的问题
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // 禁用 Turbopack 以修复字体加载问题
  // Turbopack 在 Next.js 16.0.7 中对于 Google 字体有已知问题
  // 如果需要使用 Turbopack，可以等待 Next.js 更新修复
  // 或者使用本地字体文件
  // 注意：这个配置在构建时可能不生效，需要在 package.json 中移除 --turbopack 标志
  // Netlify 部署配置
  // 不需要设置 output，Netlify Next.js 插件会自动处理
  // 不需要设置 outputFileTracingIncludes，插件会自动优化
};

export default nextConfig;
