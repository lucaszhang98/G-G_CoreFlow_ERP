# Netlify 定时任务配置指南

## 关于 Neon DB 定时任务

**Neon DB 不支持直接在数据库内设置定时任务**。

原因：
- Neon DB 是无服务器 PostgreSQL，用户没有超级用户权限
- `pg_cron` 扩展需要超级用户权限才能安装
- 这是 Neon DB 的安全限制，无法绕过

**解决方案**：使用 Netlify Scheduled Functions 调用 API 端点，由 API 连接 Neon DB 执行更新操作。

## 已实现的方案

### 1. API 端点

已创建定时任务 API 端点：
- **路径**：`/api/cron/update-system-timestamp`
- **方法**：`GET`
- **功能**：更新系统时间戳（在原有时间基础上增加 30 分钟）

### 2. 环境检查

- 只有指定的环境才执行（通过 `ENABLE_CRON_ENV` 控制）
- 避免测试和正式环境重复执行

## 配置步骤

### 方式 1：在 Netlify 控制台配置（推荐）

1. **登录 Netlify 控制台**
   - 进入你的项目

2. **配置 Scheduled Function**
   - 进入 "Functions" → "Scheduled Functions"
   - 点击 "Add scheduled function" 或 "Create scheduled function"
   - 配置：
     - **Function path**: `/api/cron/update-system-timestamp`
     - **Schedule**: `*/30 * * * *`（每 30 分钟执行一次）
     - **Timezone**: `UTC`（或你需要的时区）

3. **设置环境变量**
   - 进入 "Site settings" → "Environment variables"
   - 为 Production 环境添加：
     - `ENABLE_CRON_ENV` = `production`
     - `CRON_SECRET` = 设置一个随机字符串（可选，用于安全验证）
   - 确保 Deploy previews 和 Branch deploys 不设置 `ENABLE_CRON_ENV`

### 方式 2：使用 Netlify CLI

```bash
# 安装 Netlify CLI（如果还没安装）
npm install -g netlify-cli

# 登录 Netlify
netlify login

# 创建定时任务
netlify functions:create scheduled-function \
  --name update-system-timestamp \
  --schedule "*/30 * * * *" \
  --path "/api/cron/update-system-timestamp"
```

### 方式 3：使用 netlify.toml（如果支持）

某些 Netlify 配置可能支持在 `netlify.toml` 中配置，但 Scheduled Functions 通常需要在控制台配置。

## 环境变量配置

### Production 环境

```bash
ENABLE_CRON_ENV=production
CRON_SECRET=your-secret-key-here  # 可选，用于安全验证
CRON_INTERVAL_MINUTES=30          # 可选，默认 30 分钟
```

### Deploy Previews / Branch Deploys

```bash
# 不设置 ENABLE_CRON_ENV，或设置为其他值（如 preview）
# 这样测试环境就不会执行定时任务
```

## 验证定时任务

### 1. 查看 Netlify 日志

1. 进入 Netlify 项目
2. 查看 "Functions" → "Scheduled Functions"
3. 点击定时任务，查看执行历史
4. 确认每 30 分钟执行一次

### 2. 查询数据库

```sql
SELECT 
  config_key,
  config_value,
  updated_at
FROM public.system_config 
WHERE config_key = 'current_system_timestamp'
ORDER BY updated_at DESC;
```

如果 `updated_at` 每 30 分钟更新一次，说明定时任务正常工作。

### 3. 手动测试 API

```bash
# 测试 API 端点
curl -X GET "https://your-site.netlify.app/api/cron/update-system-timestamp?interval_minutes=30"
```

## Cron 表达式说明

Netlify 使用标准的 cron 表达式：

```
*/30 * * * *  # 每 30 分钟执行一次
0 * * * *     # 每小时执行一次
0 0 * * *     # 每天 00:00 执行一次
0 0 * * 0     # 每周日 00:00 执行一次
```

## 故障排查

### 问题：定时任务没有执行

1. **检查 Scheduled Functions 配置**：
   - 确认在 Netlify 控制台已创建定时任务
   - 确认 cron 表达式格式正确
   - 确认函数路径正确：`/api/cron/update-system-timestamp`

2. **检查环境变量**：
   - 确认 `ENABLE_CRON_ENV=production` 已设置
   - 确认当前环境匹配

3. **查看日志**：
   - 在 Netlify 控制台查看函数执行日志
   - 确认是否有错误信息

4. **手动测试**：
   - 使用 curl 手动调用 API，确认端点正常工作

### 问题：定时任务重复执行

1. **检查环境变量**：
   - 确认只有一个环境设置了 `ENABLE_CRON_ENV`
   - 确认测试环境没有设置

2. **检查 Scheduled Functions**：
   - 确认只有一个定时任务配置
   - 确认没有重复的配置

## 与 Neon DB 的配合

虽然 Neon DB 不支持数据库内定时任务，但通过 Netlify Scheduled Functions：

1. **定时任务在 Netlify 执行**：每 30 分钟调用 API
2. **API 连接 Neon DB**：通过 `DATABASE_URL` 连接数据库
3. **执行数据库操作**：调用 `update_system_timestamp()` 函数更新系统时间戳

这样实现了定时任务功能，无需数据库超级用户权限。

## 总结

- ✅ 已创建 API 端点 `/api/cron/update-system-timestamp`
- ✅ 已添加环境检查逻辑（避免测试和正式环境重复执行）
- ⚠️ 需要在 Netlify 控制台配置 Scheduled Functions
- ⚠️ 需要设置环境变量 `ENABLE_CRON_ENV=production`
- ⚠️ 需要部署代码到 Netlify

**下一步操作**：
1. 在 Netlify 控制台配置 Scheduled Functions
2. 设置环境变量
3. 部署代码
4. 等待 30 分钟后验证定时任务是否执行
