import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 避免 Next 误把上级目录当根（多 lockfile 时）：强制以本项目为根，防止用到主目录 node_modules 导致 zlib 等依赖混用
  outputFileTracingRoot: path.join(process.cwd()),

  // 确保使用 Node.js 运行时，不使用 Edge Runtime
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 强制服务端不打包 @react-pdf 和 canvas，使用 Node 原生模块（canvas 用于 logo PNG→JPEG 转换）
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@react-pdf/pdfkit',
    '@react-pdf/layout',
    '@react-pdf/font',
    '@react-pdf/render',
    '@react-pdf/primitives',
    '@react-pdf/reconciler',
    'canvas',
  ],

  // 生产优化配置
  productionBrowserSourceMaps: false, // 禁用生产环境的source maps以减少构建体积
  poweredByHeader: false, // 禁用X-Powered-By响应头
  compress: false, // 关闭可避免 Z_DATA_ERROR（与 dev/代理 冲突）；压缩可在 Nginx/CDN 做

  // 服务端打包时强制 pdfkit 使用 Node 版（main），不用 browser 版（pako），避免 Z_DATA_ERROR
  webpack: (config, { isServer }) => {
    if (isServer) {
      try {
        const nodePdfkit = require.resolve('@react-pdf/pdfkit')
        config.resolve = config.resolve ?? {}
        config.resolve.alias = { ...config.resolve.alias, '@react-pdf/pdfkit': nodePdfkit }
      } catch {
        // 未安装时忽略
      }
    }
    return config
  },

  // 性能优化
  images: {
    formats: ['image/webp'], // 使用WebP格式优化图片
    minimumCacheTTL: 86400, // 图片缓存24小时
  },
  
  // Netlify 部署配置
  // Netlify Next.js 插件会自动处理output和文件追踪
};

export default nextConfig;
