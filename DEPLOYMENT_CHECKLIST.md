# Netlify 部署检查清单

## 部署前检查

### 1. 环境变量配置
在 Netlify 控制台的 "Site settings" → "Environment variables" 中配置以下变量：

**必需的环境变量：**
- `DATABASE_URL`: Neon DB 连接字符串
- `NEXTAUTH_SECRET`: NextAuth.js 密钥（用于加密 session）
  - 生成方式：`openssl rand -base64 32`
- `NEXTAUTH_URL`: 生产环境 URL
  - 格式：`https://your-site.netlify.app`
  - 注意：不要以 `/` 结尾

**可选的环境变量：**
- `NODE_ENV`: 设置为 `production`
- `PRISMA_CLI_BINARY_TARGETS`: 如果与 netlify.toml 中的配置不同，可以在这里覆盖

### 2. Netlify 插件安装
确保在 Netlify 控制台安装了 `@netlify/plugin-nextjs` 插件：
1. 进入 "Site settings" → "Build & deploy" → "Plugins"
2. 搜索并安装 "Essential Next.js Plugin"

### 3. 构建设置
在 Netlify 控制台的 "Site settings" → "Build & deploy" → "Build settings" 中：
- **Base directory**: `web`（如果项目根目录不是 web）
- **Build command**: `npm run build`（netlify.toml 中已配置）
- **Publish directory**: `.next`（Next.js 插件会自动处理）

### 4. 函数超时配置
对于复杂查询（如库存预测计算），建议在 Netlify 控制台设置函数超时：
1. 进入 "Functions" → 选择函数
2. 设置超时时间为 26 秒（Netlify 免费版最大）

**需要设置超时的函数：**
- `/api/reports/inventory-forecast/calculate` - 库存预测计算（可能需要较长时间）

### 5. 数据库连接
确保 Neon DB 连接字符串正确：
- 检查连接字符串格式
- 确保数据库允许来自 Netlify 的 IP 连接（Neon DB 默认允许所有 IP）

### 6. 构建日志检查
部署后检查构建日志，确保：
- ✅ Prisma Client 生成成功
- ✅ TypeScript 类型检查通过
- ✅ Next.js 构建成功
- ✅ 没有依赖错误

## 部署步骤

1. **提交代码到 Git**
   ```bash
   git add .
   git commit -m "准备部署到 Netlify"
   git push
   ```

2. **在 Netlify 控制台触发部署**
   - 如果已连接 Git，会自动触发部署
   - 或者手动点击 "Trigger deploy"

3. **监控构建过程**
   - 查看构建日志
   - 检查是否有错误或警告

4. **验证部署**
   - 访问生产环境 URL
   - 测试登录功能
   - 测试主要功能（订单管理、库存管理等）

## 常见问题

### 问题 1: Prisma Client 生成失败
**解决方案：**
- 确保 `postinstall` 脚本在 package.json 中：`"postinstall": "prisma generate"`
- 检查 `PRISMA_CLI_BINARY_TARGETS` 环境变量是否正确

### 问题 2: 函数超时
**解决方案：**
- 在 Netlify 控制台增加函数超时时间
- 优化查询逻辑，减少计算时间

### 问题 3: 环境变量未生效
**解决方案：**
- 确保环境变量在 "Production" 环境中设置
- 重新部署以应用新的环境变量

### 问题 4: 数据库连接失败
**解决方案：**
- 检查 `DATABASE_URL` 是否正确
- 确保 Neon DB 允许外部连接
- 检查网络连接

## 性能优化建议

1. **启用缓存**
   - Netlify 会自动缓存静态资源
   - 确保 API 路由正确设置缓存头

2. **优化构建时间**
   - 使用 `npm ci` 而不是 `npm install`（如果 package-lock.json 存在）
   - 考虑使用构建缓存

3. **监控函数使用**
   - 定期检查函数调用次数和超时情况
   - 优化慢查询

## 回滚步骤

如果部署出现问题，可以回滚到之前的版本：
1. 进入 Netlify 控制台的 "Deploys" 页面
2. 找到之前的成功部署
3. 点击 "Publish deploy" 恢复到该版本

