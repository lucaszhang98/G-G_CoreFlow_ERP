# 🚀 部署前检查清单

## ✅ 代码检查

- [x] TypeScript 类型检查通过 (`npm run type-check`)
- [x] 构建测试通过 (`npm run build`)
- [x] 无严重 lint 错误
- [x] 数据库迁移已完成

## 🔧 配置检查

### Netlify 配置 (`netlify.toml`)
- [x] Node.js 版本：20
- [x] Prisma 二进制目标：`rhel-openssl-3.0.x`
- [x] 构建命令：`npm run build`
- [x] Next.js 插件已配置

### Next.js 配置 (`next.config.ts`)
- [x] 无 `output: 'standalone'`（Netlify 插件自动处理）
- [x] Server Actions 配置正确

### Prisma 配置
- [x] Schema 已更新
- [x] 客户端已生成 (`npx prisma generate`)

## 🔐 环境变量（Netlify 控制台）

### 必需变量
- [ ] `DATABASE_URL` - PostgreSQL 连接字符串
- [ ] `AUTH_SECRET` - 至少 32 字符的密钥
- [ ] `AUTH_URL` - 生产环境 URL（如：`https://your-app.netlify.app`）

### 可选变量
- [ ] `NODE_ENV` - 设置为 `production`
- [ ] `NEXT_PUBLIC_APP_URL` - 前端 URL（如需要）

## 📦 依赖检查

- [x] `package.json` 依赖已更新
- [x] `package-lock.json` 已提交
- [x] 无安全漏洞（`npm audit`）

## 🗄️ 数据库准备

- [ ] 生产数据库已创建
- [ ] 数据库迁移已运行 (`npx prisma migrate deploy`)
- [ ] 测试用户已创建（如需要）
- [ ] 数据库连接测试通过

## 🚀 部署步骤

1. **推送代码到主分支**
   ```bash
   git add .
   git commit -m "准备部署"
   git push origin main
   ```

2. **在 Netlify 控制台**
   - 检查构建日志
   - 验证环境变量
   - 检查函数超时设置（建议 10-30 秒）

3. **部署后验证**
   - [ ] 网站可以访问
   - [ ] 登录功能正常
   - [ ] 主要功能测试通过
   - [ ] API 响应正常

## ⚠️ 常见问题

### 构建失败
- 检查 Node.js 版本是否为 20
- 检查 Prisma 二进制目标
- 查看构建日志中的具体错误

### 数据库连接失败
- 验证 `DATABASE_URL` 格式
- 检查数据库 IP 白名单
- 检查 SSL 模式

### 认证失败
- 确保 `AUTH_SECRET` 已设置
- 确保 `AUTH_URL` 与域名匹配

## 📝 部署后任务

- [ ] 验证所有功能
- [ ] 检查错误日志
- [ ] 监控性能指标
- [ ] 通知团队成员

---

**最后更新**: 2025-12-08
**状态**: ✅ 准备就绪


