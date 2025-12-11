# 定时任务设置指南

## Neon DB 限制说明

**Neon DB 不支持直接在数据库内设置定时任务**（`pg_cron` 扩展需要特殊权限，且只能在 `postgres` 数据库中创建）。

因此，我们需要使用**外部定时任务**来定期更新系统时间戳。

## 已实现的方案

### 1. API 端点

已创建定时任务 API 端点：
- **路径**：`/api/cron/update-system-timestamp`
- **方法**：`GET`
- **参数**：`interval_minutes`（可选，默认 30 分钟）
- **安全**：需要 `CRON_SECRET` 环境变量验证

### 2. Vercel Cron Jobs（推荐）

如果使用 Vercel 部署，已配置 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron/update-system-timestamp?interval_minutes=30",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**配置步骤：**
1. 在 Vercel 项目设置中添加环境变量 `CRON_SECRET`
2. 部署项目后，Vercel 会自动执行定时任务
3. 每 30 分钟自动调用 API，更新系统时间戳

### 3. 应用层定时任务（Node.js）

如果使用其他部署方式，可以在应用层实现：

```typescript
// lib/cron/setup-cron.ts
import cron from 'node-cron'

export function setupCronJobs() {
  // 每 30 分钟更新系统时间戳
  cron.schedule('*/30 * * * *', async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/update-system-timestamp?interval_minutes=30`, {
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        }
      })
      
      if (!response.ok) {
        console.error('定时任务更新系统时间戳失败:', await response.text())
      } else {
        console.log('定时任务更新系统时间戳成功')
      }
    } catch (error) {
      console.error('定时任务执行失败:', error)
    }
  })
}
```

在应用启动时调用：

```typescript
// app/layout.tsx 或 app/api/route.ts
import { setupCronJobs } from '@/lib/cron/setup-cron'

// 只在服务器端执行
if (typeof window === 'undefined') {
  setupCronJobs()
}
```

### 4. 外部 Cron 服务

如果使用其他云服务，可以设置外部 Cron 任务：

#### GitHub Actions

```yaml
# .github/workflows/update-timestamp.yml
name: Update System Timestamp

on:
  schedule:
    - cron: '*/30 * * * *'  # 每 30 分钟
  workflow_dispatch:  # 允许手动触发

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Update System Timestamp
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/update-system-timestamp?interval_minutes=30" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

#### 其他云服务

- **AWS Lambda + EventBridge**：设置定时触发器
- **Google Cloud Functions + Cloud Scheduler**：设置定时任务
- **Azure Functions + Timer Trigger**：设置定时触发器

## 环境变量配置

需要在部署环境中设置：

```bash
# .env.local 或部署平台的环境变量
CRON_SECRET=your-secret-key-here  # 用于验证定时任务请求
```

## 验证定时任务

### 手动测试

```bash
# 使用 curl 测试
curl -X GET "https://your-domain.com/api/cron/update-system-timestamp?interval_minutes=30" \
  -H "Authorization: Bearer your-cron-secret"
```

### 检查系统时间戳

```sql
-- 查询当前系统时间戳
SELECT public.get_current_system_timestamp();

-- 查询配置信息
SELECT * FROM public.system_config 
WHERE config_key = 'current_system_timestamp';
```

## 定时任务执行逻辑

1. **每 30 分钟执行一次**
2. **在原有时间基础上增加 30 分钟**
   - 例如：00:13 → 00:43 → 01:13 → 01:43 → ...
3. **不进行时区转换**，按照系统约定的时区理解

## 监控和日志

定时任务执行后，会在控制台输出日志：

```
[系统时间戳服务] 系统时间戳已更新为: 2025-12-11T08:43:11.502Z
```

可以在 Vercel 的日志中查看，或通过数据库查询验证：

```sql
SELECT 
  config_value as system_timestamp,
  updated_at as last_updated
FROM public.system_config 
WHERE config_key = 'current_system_timestamp';
```

## 故障处理

如果定时任务失败：

1. **检查环境变量**：确保 `CRON_SECRET` 已设置
2. **检查 API 端点**：确保 `/api/cron/update-system-timestamp` 可访问
3. **检查数据库连接**：确保数据库连接正常
4. **手动触发**：可以通过 API 手动触发更新

## 总结

虽然 Neon DB 不支持数据库内定时任务，但通过外部定时任务（Vercel Cron Jobs、应用层定时任务等）可以实现相同的功能。推荐使用 **Vercel Cron Jobs**，配置简单且可靠。

