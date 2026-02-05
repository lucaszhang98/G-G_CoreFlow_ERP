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
  compress: false, // 关闭可避免 Z_DATA_ERROR（与 dev/代理 冲突）；压缩可在 Nginx/CDN 做
  
  // 性能优化
  images: {
    formats: ['image/webp'], // 使用WebP格式优化图片
    minimumCacheTTL: 86400, // 图片缓存24小时
  },
  
  // Netlify 部署配置
  // Netlify Next.js 插件会自动处理output和文件追踪
};

export default nextConfig;
