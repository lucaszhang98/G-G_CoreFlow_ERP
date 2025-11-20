# 部署前检查清单

## ✅ 代码检查（已完成）

- [x] TypeScript 类型检查配置（`prebuild` 脚本）
- [x] ESLint 配置完善
- [x] 构建测试通过（本地）
- [x] Netlify 配置文件就绪（`netlify.toml`）
- [x] 所有类型错误已修复

## 🔧 Netlify 环境变量配置（必须设置）

在 Netlify 控制台设置以下环境变量：

### 必需的环境变量

1. **`DATABASE_URL`** ⚠️ **必需**
   - Neon PostgreSQL 数据库连接字符串
   - 格式：`postgresql://user:password@host/database?sslmode=require`
   - 获取方式：Neon 控制台 → 项目 → Connection String

2. **`NEXTAUTH_SECRET`** ⚠️ **必需**
   - NextAuth.js 的加密密钥
   - 生成方式：
     ```bash
     openssl rand -base64 32
     ```
   - 或者使用在线工具生成随机字符串

3. **`NEXTAUTH_URL`** ⚠️ **必需**
   - 应用的完整 URL
   - 格式：`https://your-site.netlify.app`
   - Netlify 可能会自动设置，但建议手动确认

### 在 Netlify 中设置环境变量

1. 登录 Netlify 控制台
2. 选择你的站点
3. 进入 **Site settings** → **Environment variables**
4. 点击 **Add variable** 添加以上三个变量

## 📋 部署步骤

### 1. 提交代码到 GitHub

```bash
cd web
git add .
git commit -m "准备部署：修复类型错误和配置 Netlify"
git push
```

### 2. 在 Netlify 中配置环境变量

如上所述，设置三个必需的环境变量。

### 3. 触发部署

- 如果已连接 GitHub，Netlify 会自动部署
- 或者手动触发：**Deploys** → **Trigger deploy**

### 4. 验证部署

- 检查构建日志，确保没有错误
- 访问部署的站点，测试登录功能
- 测试关键功能（客户管理、订单管理等）

## ⚠️ 注意事项

1. **环境变量安全**：
   - 不要将 `.env.local` 提交到 Git（已在 `.gitignore` 中）
   - `NEXTAUTH_SECRET` 生产环境必须使用强密钥

2. **数据库连接**：
   - 确保 Neon 数据库允许来自 Netlify 的访问
   - 检查防火墙设置（如果需要）

3. **首次部署**：
   - 首次部署可能需要 3-5 分钟
   - Prisma 需要生成 Client 和查询引擎

4. **监控构建日志**：
   - 关注是否有类型错误
   - 检查 Prisma Client 生成是否成功
   - 确认环境变量是否正确加载

## 🐛 常见问题

### 构建失败：类型错误
- 检查 `prebuild` 脚本是否正常运行
- 查看构建日志中的具体错误位置

### 运行时错误：环境变量未找到
- 确认 Netlify 环境变量已正确设置
- 检查变量名称是否正确（大小写敏感）

### Prisma 错误：无法连接到数据库
- 检查 `DATABASE_URL` 是否正确
- 确认 Neon 数据库已启动
- 检查网络连接

## ✅ 验证清单

部署后请验证：
- [ ] 站点可以正常访问
- [ ] 登录功能正常
- [ ] 数据库连接正常
- [ ] API 路由正常工作
- [ ] 关键业务功能可用

