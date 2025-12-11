# 定时任务环境配置指南

## 问题：测试和正式环境共用数据库

如果测试环境和正式环境使用同一个数据库，定时任务可能会重复执行，导致系统时间戳被错误地多次更新。

## 解决方案：环境变量控制

### 1. 环境变量配置

通过 `ENABLE_CRON_ENV` 环境变量控制哪个环境应该执行定时任务。

#### 正式环境（Production）

在 Vercel 的正式环境设置中添加：

```bash
ENABLE_CRON_ENV=production
CRON_SECRET=your-secret-key-here
```

#### 测试环境（Preview/Development）

在 Vercel 的预览环境设置中添加：

```bash
ENABLE_CRON_ENV=preview
# 或者不设置，这样测试环境就不会执行定时任务
```

### 2. 定时任务逻辑

定时任务会检查当前环境：

- **如果设置了 `ENABLE_CRON_ENV`**：
  - 只有当前环境匹配 `ENABLE_CRON_ENV` 时才执行
  - 不匹配时返回 `skipped: true`，不执行更新

- **如果没有设置 `ENABLE_CRON_ENV`**：
  - 所有环境都会执行（不推荐，除非确实需要）

### 3. Vercel 环境变量设置

#### 方式 1：在 Vercel 控制台设置

1. 进入 Vercel 项目设置
2. 选择 "Environment Variables"
3. 为不同环境设置不同的值：
   - **Production**: `ENABLE_CRON_ENV=production`
   - **Preview**: `ENABLE_CRON_ENV=preview`（或留空）
   - **Development**: 不设置（或设置为 `development`）

#### 方式 2：在 `vercel.json` 中设置（仅限 Production）

```json
{
  "crons": [
    {
      "path": "/api/cron/update-system-timestamp?interval_minutes=30",
      "schedule": "*/30 * * * *"
    }
  ],
  "env": {
    "ENABLE_CRON_ENV": "production"
  }
}
```

注意：`vercel.json` 中的 `env` 只对 Production 环境生效。

### 4. 推荐配置

#### 场景 1：只有正式环境执行定时任务（推荐）

**正式环境（Production）**：
```bash
ENABLE_CRON_ENV=production
CRON_SECRET=your-secret-key
```

**测试环境（Preview/Development）**：
```bash
# 不设置 ENABLE_CRON_ENV，或设置为其他值
# 这样测试环境就不会执行定时任务
```

#### 场景 2：测试和正式环境都执行，但使用不同的时间间隔

**正式环境（Production）**：
```bash
ENABLE_CRON_ENV=production
CRON_SECRET=your-secret-key
```

**测试环境（Preview）**：
```bash
ENABLE_CRON_ENV=preview
CRON_SECRET=your-secret-key
```

然后在 `vercel.json` 中为不同环境配置不同的 cron 任务（需要分别部署）。

### 5. 验证配置

#### 检查当前环境

定时任务会返回当前环境信息：

```json
{
  "skipped": true,
  "message": "定时任务已跳过：当前环境 preview 不匹配配置的环境 production",
  "current_env": "preview",
  "required_env": "production"
}
```

#### 手动测试

```bash
# 测试环境（应该被跳过）
curl -X GET "https://your-preview-url.vercel.app/api/cron/update-system-timestamp" \
  -H "Authorization: Bearer your-secret"

# 正式环境（应该执行）
curl -X GET "https://your-production-url.vercel.app/api/cron/update-system-timestamp" \
  -H "Authorization: Bearer your-secret"
```

### 6. 环境变量优先级

定时任务按以下顺序检查环境：

1. `NODE_ENV`（Next.js 标准环境变量）
2. `VERCEL_ENV`（Vercel 自动设置：`production`、`preview`、`development`）
3. 默认值：`development`

### 7. 最佳实践

#### ✅ 推荐做法

1. **只有正式环境执行定时任务**
   - 正式环境：`ENABLE_CRON_ENV=production`
   - 测试环境：不设置 `ENABLE_CRON_ENV`

2. **使用不同的 CRON_SECRET**
   - 正式环境和测试环境使用不同的密钥
   - 提高安全性

3. **监控定时任务执行**
   - 在 Vercel 日志中查看定时任务执行情况
   - 检查是否有 `skipped: true` 的日志

#### ❌ 不推荐做法

1. **所有环境都执行定时任务**
   - 如果共用数据库，会导致时间戳被多次更新

2. **不设置环境变量**
   - 无法区分测试和正式环境

3. **在测试环境频繁执行**
   - 浪费资源，且可能影响正式环境数据

### 8. 故障排查

#### 问题：定时任务没有执行

1. 检查 `ENABLE_CRON_ENV` 是否设置正确
2. 检查当前环境是否匹配
3. 查看 Vercel 日志，确认是否有 `skipped` 消息

#### 问题：定时任务重复执行

1. 确认只有一个环境设置了 `ENABLE_CRON_ENV`
2. 检查是否有多个 Vercel 项目部署到同一个数据库
3. 查看 Vercel Cron Jobs 配置，确认只有一个 cron 任务

### 9. 总结

通过 `ENABLE_CRON_ENV` 环境变量，可以精确控制哪个环境执行定时任务，避免测试和正式环境共用数据库时的重复执行问题。

**推荐配置**：
- 正式环境：`ENABLE_CRON_ENV=production`
- 测试环境：不设置（或设置为其他值，如 `preview`）

这样只有正式环境会执行定时任务，测试环境会被自动跳过。

