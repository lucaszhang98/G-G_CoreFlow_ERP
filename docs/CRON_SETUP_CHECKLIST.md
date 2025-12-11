# 定时任务配置检查清单

## ✅ 已完成（代码层面）

### 1. 数据库配置
- [x] `system_config` 表已创建
- [x] `current_business_date` 配置项已创建
- [x] `current_system_timestamp` 配置项已创建
- [x] `get_current_business_date()` 函数已创建
- [x] `update_business_date()` 函数已创建
- [x] `get_current_system_timestamp()` 函数已创建
- [x] `update_system_timestamp()` 函数已创建
- [x] `set_system_timestamp()` 函数已创建

### 2. 后端服务
- [x] `lib/services/business-date-service.ts` 已创建
- [x] `lib/services/system-timestamp-service.ts` 已创建
- [x] `app/api/system/business-date/route.ts` 已创建
- [x] `app/api/admin/system/business-date/route.ts` 已创建
- [x] `app/api/system/timestamp/route.ts` 已创建
- [x] `app/api/admin/system/timestamp/route.ts` 已创建
- [x] `app/api/cron/update-system-timestamp/route.ts` 已创建

### 3. Vercel 配置
- [x] `vercel.json` 已创建，包含 cron 任务配置
- [x] 环境检查逻辑已添加（避免测试和正式环境重复执行）

### 4. 文档
- [x] `docs/BUSINESS_DATE_ARCHITECTURE.md` 已创建
- [x] `docs/SYSTEM_TIMESTAMP_UPDATE_FREQUENCY.md` 已创建
- [x] `docs/CRON_SETUP_GUIDE.md` 已创建
- [x] `docs/CRON_ENVIRONMENT_SETUP.md` 已创建

## ⚠️ 需要你手动操作（部署层面）

### 1. Vercel 环境变量设置

在 Vercel 项目设置中添加以下环境变量：

#### 正式环境（Production）
```bash
ENABLE_CRON_ENV=production
CRON_SECRET=your-secret-key-here  # 设置一个强密码
```

#### 测试环境（Preview/Development）
```bash
# 不设置 ENABLE_CRON_ENV，或设置为其他值（如 preview）
# 这样测试环境就不会执行定时任务
```

**设置步骤：**
1. 登录 Vercel 控制台
2. 选择你的项目
3. 进入 "Settings" → "Environment Variables"
4. 为 Production 环境添加：
   - `ENABLE_CRON_ENV` = `production`
   - `CRON_SECRET` = 设置一个随机字符串（如：`openssl rand -hex 32`）
5. 确保 Preview 和 Development 环境不设置 `ENABLE_CRON_ENV`

### 2. 部署到 Vercel

确保代码已部署到 Vercel：
```bash
# 如果还没部署，执行：
vercel --prod
```

### 3. 验证定时任务

部署后，等待 30 分钟，然后检查：

#### 方式 1：查看 Vercel 日志
1. 进入 Vercel 项目
2. 查看 "Deployments" → 选择最新部署 → "Functions" → `/api/cron/update-system-timestamp`
3. 查看执行日志，确认定时任务是否正常执行

#### 方式 2：查询数据库
```sql
SELECT 
  config_key,
  config_value,
  updated_at
FROM public.system_config 
WHERE config_key = 'current_system_timestamp';
```

如果 `updated_at` 每 30 分钟更新一次，说明定时任务正常工作。

#### 方式 3：手动测试 API
```bash
# 测试定时任务端点（需要设置 CRON_SECRET）
curl -X GET "https://your-domain.vercel.app/api/cron/update-system-timestamp?interval_minutes=30" \
  -H "Authorization: Bearer your-cron-secret"
```

## 📋 配置总结

### 当前配置状态

| 项目 | 状态 | 说明 |
|------|------|------|
| 数据库表和函数 | ✅ 完成 | 已创建并测试 |
| 后端服务代码 | ✅ 完成 | 所有 API 端点已创建 |
| Vercel cron 配置 | ✅ 完成 | `vercel.json` 已配置 |
| 环境检查逻辑 | ✅ 完成 | 避免重复执行 |
| Vercel 环境变量 | ⚠️ 待设置 | 需要在 Vercel 控制台手动设置 |
| 部署到 Vercel | ⚠️ 待部署 | 需要部署代码 |
| 验证定时任务 | ⚠️ 待验证 | 部署后等待 30 分钟验证 |

### 下一步操作

1. **立即操作**：
   - [ ] 在 Vercel 设置环境变量 `ENABLE_CRON_ENV=production` 和 `CRON_SECRET`
   - [ ] 部署代码到 Vercel（如果还没部署）

2. **部署后验证**：
   - [ ] 等待 30 分钟，检查定时任务是否执行
   - [ ] 查看 Vercel 日志，确认没有错误
   - [ ] 查询数据库，确认时间戳已更新

3. **长期监控**：
   - [ ] 定期检查定时任务执行情况
   - [ ] 监控系统时间戳是否正常更新

## 🔍 故障排查

如果定时任务没有执行：

1. **检查环境变量**：
   - 确认 `ENABLE_CRON_ENV=production` 已设置
   - 确认 `CRON_SECRET` 已设置

2. **检查 Vercel Cron Jobs**：
   - 进入 Vercel 项目 → "Settings" → "Cron Jobs"
   - 确认 cron 任务已创建并启用

3. **检查日志**：
   - 查看 Vercel 函数日志
   - 确认是否有错误信息

4. **手动测试**：
   - 使用 curl 手动调用 API，确认端点正常工作

## ✅ 完成标准

当以下所有条件都满足时，说明配置完成：

- [x] 数据库表和函数已创建
- [x] 后端服务代码已创建
- [x] Vercel cron 配置已创建
- [ ] Vercel 环境变量已设置
- [ ] 代码已部署到 Vercel
- [ ] 定时任务已执行至少一次（等待 30 分钟验证）

