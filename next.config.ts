import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 确保使用 Node.js 运行时，不使用 Edge Runtime
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // 生产优化配置
  productionBrowserSourceMaps: false, // 禁用生产环境的source maps以减少构建体积
  poweredByHeader: false, // 禁用X-Powered-By响应头
  compress: true, // 启用gzip压缩
  
  // 性能优化
  images: {
    formats: ['image/webp'], // 使用WebP格式优化图片
    minimumCacheTTL: 86400, // 图片缓存24小时
  },
  
  // 部署配置
  // Vercel 部署：使用默认配置，自动优化
  // 如果需要部署到子目录，取消下面的注释并设置 basePath
  // basePath: '/subdirectory',
};

export default nextConfig;
