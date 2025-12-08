# 生产环境部署指南

## 前置准备

### 1. 环境变量配置

在 Netlify 控制台配置以下环境变量：

#### 必需变量
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `AUTH_SECRET`: 用于会话加密的密钥（至少 32 字符）
- `AUTH_URL`: 生产环境 URL（例如：`https://your-domain.netlify.app`）

#### 可选变量
- `NODE_ENV`: 设置为 `production`
- `NEXT_PUBLIC_APP_URL`: 应用的前端 URL（用于 API 调用）

### 2. 数据库准备

1. **运行 Prisma 迁移**
   ```bash
   npx prisma migrate deploy
   ```

2. **创建必要的用户账号**
   ```bash
   npx tsx scripts/restore-users.ts
   ```

3. **验证数据库连接**
   - 确保 `DATABASE_URL` 指向正确的生产数据库
   - 测试连接是否正常

### 3. 构建配置检查

- ✅ Next.js 配置：`next.config.ts`
- ✅ Netlify 配置：`netlify.toml`
- ✅ Node.js 版本：20
- ✅ Prisma 二进制目标：`rhel-openssl-3.0.x`

## 部署步骤

### 1. 代码检查

```bash
# 类型检查
npm run type-check

# 构建测试
npm run build
```

### 2. Netlify 部署

1. **连接 Git 仓库**
   - 在 Netlify 控制台连接你的 Git 仓库
   - 选择主分支（通常是 `main` 或 `master`）

2. **配置构建设置**
   - 构建命令：`npm run build`
   - 发布目录：`.next`（由 Netlify Next.js 插件自动处理）

3. **配置环境变量**
   - 在 Netlify 控制台的 "Site settings" > "Environment variables" 中添加所有必需变量

4. **配置函数超时**
   - 在 Netlify 控制台的 "Functions" 设置中
   - 建议超时时间：10-30 秒（根据 API 复杂度调整）

### 3. 部署后验证

1. **检查部署日志**
   - 确保构建成功
   - 检查是否有错误或警告

2. **功能测试**
   - 登录功能
   - 主要业务流程
   - API 响应时间

3. **性能监控**
   - 检查页面加载速度
   - 监控 API 响应时间
   - 检查数据库连接池

## 故障排查

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本是否为 20
   - 检查 Prisma 二进制目标是否正确
   - 查看构建日志中的具体错误

2. **数据库连接失败**
   - 验证 `DATABASE_URL` 是否正确
   - 检查数据库是否允许来自 Netlify 的 IP 连接
   - 检查 SSL 模式设置

3. **认证失败**
   - 确保 `AUTH_SECRET` 已设置且足够长（至少 32 字符）
   - 确保 `AUTH_URL` 与生产域名匹配

4. **函数超时**
   - 检查慢查询
   - 优化数据库查询
   - 增加函数超时时间（如果必要）

## 维护

### 定期任务

1. **数据库备份**
   - 定期备份生产数据库
   - 测试恢复流程

2. **依赖更新**
   - 定期更新依赖包
   - 测试更新后的功能

3. **日志监控**
   - 定期检查 Netlify 函数日志
   - 监控错误率

### 更新部署

1. 推送代码到主分支
2. Netlify 自动触发构建
3. 验证新版本功能
4. 如有问题，使用 Netlify 的回滚功能

## 安全建议

1. **环境变量安全**
   - 不要在代码中硬编码敏感信息
   - 定期轮换密钥

2. **数据库安全**
   - 使用强密码
   - 限制数据库访问 IP
   - 启用 SSL 连接

3. **API 安全**
   - 确保所有 API 路由都有权限检查
   - 验证用户输入
   - 防止 SQL 注入和 XSS 攻击

## 支持

如有问题，请查看：
- Netlify 文档：https://docs.netlify.com
- Next.js 文档：https://nextjs.org/docs
- Prisma 文档：https://www.prisma.io/docs


