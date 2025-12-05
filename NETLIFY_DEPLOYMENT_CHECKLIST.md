# Netlify 部署检查清单

## ✅ 已完成的配置

### 1. Netlify 配置文件 (`netlify.toml`)
- ✅ 构建命令：`npm run build`
- ✅ Node.js 版本：20
- ✅ Prisma 二进制目标：`rhel-openssl-3.0.x`
- ✅ Netlify Next.js 插件配置
- ✅ 函数超时时间：10 秒

### 2. Next.js 配置 (`next.config.ts`)
- ✅ 使用 Node.js 运行时（不使用 Edge Runtime）
- ✅ Server Actions 配置：bodySizeLimit 2mb
- ✅ 输出模式：由 Netlify 插件自动处理

### 3. 代码优化
- ✅ 移除了所有调试日志（console.log）
- ✅ TypeScript 编译通过
- ✅ 构建成功

### 4. 中间件配置
- ✅ 中间件使用 Next.js 16 标准格式
- ✅ 匹配规则正确配置
- ✅ Netlify 插件会自动处理中间件

## 🔍 部署前检查项

### 环境变量（在 Netlify 控制台配置）
确保以下环境变量已配置：
- `DATABASE_URL` - 数据库连接字符串
- `NEXTAUTH_SECRET` - NextAuth.js 密钥
- `NEXTAUTH_URL` - 应用 URL（例如：https://your-app.netlify.app）
- `NODE_ENV` - 设置为 `production`

### Netlify 插件安装
1. 在 Netlify 控制台的 "Plugins" 部分
2. 确保安装了 `@netlify/plugin-nextjs`
3. 如果没有安装，在 Netlify 控制台搜索并安装

### 构建设置
1. 基础目录：`web`（如果项目在子目录中）
2. 构建命令：`npm run build`（已在 netlify.toml 中配置）
3. 发布目录：留空（由插件自动处理）

### 数据库迁移
1. 确保生产数据库已应用所有 Prisma 迁移
2. 运行 `npx prisma migrate deploy` 在生产环境

### 功能验证
部署后验证以下功能：
- [ ] 用户登录/登出
- [ ] API 路由正常工作
- [ ] 数据库连接正常
- [ ] 中间件重定向正常
- [ ] 静态资源加载正常
- [ ] 表格视图管理功能正常（localStorage）

## ⚠️ 常见问题

### 1. Prisma 查询引擎错误
- 确保 `PRISMA_CLI_BINARY_TARGETS` 环境变量设置为 `rhel-openssl-3.0.x`
- 确保在构建时运行 `prisma generate`

### 2. 函数超时
- 如果 API 请求超时，考虑增加函数超时时间（需要 Netlify Pro）
- 优化数据库查询性能

### 3. 中间件问题
- 确保中间件匹配规则不包含 API 路由
- Netlify 插件会自动处理中间件转换

### 4. 环境变量
- 确保所有必要的环境变量都在 Netlify 控制台中配置
- 区分开发和生产环境变量

## 📝 部署命令

```bash
# 本地测试构建
cd web
npm run build

# 检查 TypeScript 错误
npm run type-check

# 检查代码规范
npm run lint
```

## 🔗 相关文档
- [Netlify Next.js 插件文档](https://github.com/netlify/netlify-plugin-nextjs)
- [Next.js 16 部署文档](https://nextjs.org/docs/deployment)
- [Prisma 部署文档](https://www.prisma.io/docs/guides/deployment)

