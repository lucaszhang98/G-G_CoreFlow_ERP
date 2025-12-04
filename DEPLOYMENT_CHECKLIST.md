# 部署检查清单

## ✅ 已完成的检查

### 1. TypeScript 类型检查
- ✅ 所有 TypeScript 类型错误已修复
- ✅ `npm run type-check` 通过

### 2. 构建测试
- ✅ `npm run build` 成功完成
- ✅ 所有路由已正确生成

### 3. 代码修复
- ✅ 修复了 `appointment-detail-lines` API 中的变量作用域问题
- ✅ 修复了 `order-details` API 中的类型问题
- ✅ 修复了 `orders/[id]/page.tsx` 中的 `container_volume` 问题（使用 `weight` 字段）
- ✅ 修复了 `outbound-shipments.ts` 配置中的 `inlineEdit` 和 `batchOperations` 位置问题

## 📋 部署前必须检查的事项

### 环境变量配置
确保以下环境变量在生产环境中已正确配置：

1. **数据库连接**
   - `DATABASE_URL` - Neon PostgreSQL 连接字符串

2. **NextAuth 配置**
   - `NEXTAUTH_SECRET` - 用于加密 session token 的密钥（生产环境必须设置）
   - `NEXTAUTH_URL` - 应用的完整 URL（例如：`https://yourdomain.com`）

3. **Node 环境**
   - `NODE_ENV=production` - 确保在生产环境设置为 `production`

### 数据库迁移
- ✅ Prisma schema 已更新
- ⚠️ **重要**：部署前需要运行数据库迁移
  ```bash
  npx prisma migrate deploy
  ```
  或者使用 Neon MCP 工具进行迁移

### 构建和启动命令
```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 构建应用
npm run build

# 启动生产服务器
npm start
```

### 常见部署问题

1. **Prisma Client 未生成**
   - 确保在构建前运行 `npx prisma generate`
   - 检查 `postinstall` 脚本是否正常工作

2. **环境变量缺失**
   - 检查所有 `process.env.*` 的使用
   - 确保生产环境配置了所有必需的环境变量

3. **数据库连接问题**
   - 检查 `DATABASE_URL` 是否正确
   - 确保数据库允许来自部署服务器的连接

4. **NextAuth 配置**
   - 确保 `NEXTAUTH_SECRET` 已设置（至少 32 个字符）
   - 确保 `NEXTAUTH_URL` 指向正确的域名

5. **BigInt 序列化**
   - 所有 API 响应都使用 `serializeBigInt` 处理
   - 确保 JSON 序列化正确

### 性能优化建议

1. **数据库连接池**
   - Prisma 默认使用连接池，无需额外配置

2. **静态资源**
   - Next.js 会自动优化静态资源
   - 确保图片等资源已正确优化

3. **API 路由**
   - 所有 API 路由都使用正确的错误处理
   - 确保响应时间合理

### 安全检查

1. **认证和授权**
   - ✅ 所有 API 路由都使用 `checkAuth()` 检查登录
   - ✅ 权限检查已实现

2. **SQL 注入防护**
   - ✅ 使用 Prisma ORM，自动防护 SQL 注入
   - ⚠️ 注意：代码中使用了 `$executeRaw` 和 `$queryRaw`，确保参数已正确转义

3. **XSS 防护**
   - ✅ React 自动转义用户输入
   - ✅ 使用 Zod 进行输入验证

### 监控和日志

1. **错误日志**
   - 生产环境中的 `console.error` 会被记录
   - 建议配置错误监控服务（如 Sentry）

2. **性能监控**
   - 建议配置 APM 工具监控 API 响应时间

## 🚀 部署步骤

1. **准备环境变量**
   ```bash
   # 创建 .env.production 文件
   DATABASE_URL=your_production_database_url
   NEXTAUTH_SECRET=your_secret_key_at_least_32_chars
   NEXTAUTH_URL=https://yourdomain.com
   NODE_ENV=production
   ```

2. **运行数据库迁移**
   ```bash
   npx prisma migrate deploy
   ```

3. **构建应用**
   ```bash
   npm run build
   ```

4. **启动服务**
   ```bash
   npm start
   ```

5. **验证部署**
   - 访问应用首页
   - 测试登录功能
   - 测试主要功能模块

## 📝 注意事项

- 确保所有依赖都已安装（`npm install`）
- 确保 Prisma Client 已生成（`npx prisma generate`）
- 确保数据库连接正常
- 确保环境变量已正确配置
- 建议在部署前进行完整的端到端测试

