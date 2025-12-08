# 发布前检查清单

## ✅ 已完成的优化

### 1. 代码清理
- ✅ 清理了调试用的 `console.log` 和 `console.warn`
- ✅ 保留了必要的错误日志（`console.error`）
- ✅ 生产环境错误日志已优化，减少敏感信息输出
- ✅ 类型检查通过（`npm run type-check`）
- ✅ 构建测试通过（`npm run build`）

### 2. 配置检查
- ✅ Next.js 配置正确（`next.config.ts`）
- ✅ Netlify 配置正确（`netlify.toml`）
- ✅ Node.js 版本：20
- ✅ Prisma 二进制目标：`rhel-openssl-3.0.x`

### 3. 文档准备
- ✅ 创建了部署指南（`DEPLOYMENT.md`）
- ✅ 创建了生产环境准备脚本（`scripts/prepare-production.ts`）

## 📋 部署前必做事项

### 环境变量配置（Netlify 控制台）

1. **DATABASE_URL**
   - 格式：`postgresql://user:password@host:port/database?sslmode=require`
   - 确保指向生产数据库

2. **AUTH_SECRET**
   - 至少 32 字符的随机字符串
   - 用于会话加密，必须保密

3. **AUTH_URL**
   - 生产环境 URL（例如：`https://your-domain.netlify.app`）
   - 必须与 Netlify 分配的域名匹配

4. **NODE_ENV**（可选）
   - 设置为 `production`

### 数据库准备

1. **运行 Prisma 迁移**
   ```bash
   npx prisma migrate deploy
   ```

2. **创建用户账号**
   ```bash
   npx tsx scripts/restore-users.ts
   ```
   
   默认账号：
   - 管理员：`admin` / `admin123`
   - OMS测试：`omstest` / `omstest123`

3. **验证数据库连接**
   - 测试连接是否正常
   - 检查表结构是否正确

### Netlify 配置

1. **构建设置**
   - 构建命令：`npm run build`
   - 发布目录：`.next`（自动处理）

2. **函数设置**
   - 超时时间：建议 10-30 秒
   - Node.js 版本：20

3. **环境变量**
   - 在 Netlify 控制台配置所有必需变量
   - 确保变量值正确

## 🚀 部署步骤

1. **推送代码到主分支**
   ```bash
   git add .
   git commit -m "准备生产环境发布"
   git push origin main
   ```

2. **Netlify 自动构建**
   - Netlify 会自动检测推送并开始构建
   - 监控构建日志，确保成功

3. **验证部署**
   - 访问生产 URL
   - 测试登录功能
   - 测试主要业务流程

## ⚠️ 注意事项

1. **不要在生产环境使用测试数据**
   - 确保数据库已清空测试数据
   - 使用 `scripts/clear-all-data.ts` 清理（如需要）

2. **安全建议**
   - 定期轮换 `AUTH_SECRET`
   - 使用强数据库密码
   - 限制数据库访问 IP

3. **性能监控**
   - 监控 API 响应时间
   - 检查数据库查询性能
   - 优化慢查询

## 📞 故障排查

如果遇到问题，请查看：
- `DEPLOYMENT.md` - 详细部署指南
- Netlify 构建日志
- 浏览器控制台错误
- 网络请求失败信息

## ✅ 最终检查

在部署前，请确认：

- [ ] 所有环境变量已配置
- [ ] 数据库已准备就绪
- [ ] 用户账号已创建
- [ ] 代码已推送到主分支
- [ ] 构建测试通过
- [ ] 类型检查通过
- [ ] 已阅读 `DEPLOYMENT.md`

---

**准备就绪！可以开始部署了！** 🎉

