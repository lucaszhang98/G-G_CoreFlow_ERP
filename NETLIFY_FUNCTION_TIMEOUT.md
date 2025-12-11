# Netlify 函数超时配置指南

## 问题说明

库存预测计算 API (`/api/reports/inventory-forecast/calculate`) 在生产环境返回 502 错误，通常是因为函数超时。

## 解决方案

### 1. 代码层面（已实现）

在 API 路由文件中添加 `maxDuration` 配置：

```typescript
// app/api/reports/inventory-forecast/calculate/route.ts
export const maxDuration = 26  // Netlify 免费版最大 26 秒
```

### 2. Netlify 控制台配置

如果代码层面的配置不够，需要在 Netlify 控制台手动设置：

1. **进入 Netlify 控制台**
   - 选择你的站点
   - 进入 "Functions" 页面

2. **找到对应的函数**
   - 函数路径：`/.netlify/functions/next`
   - 或者直接在 "Functions" 列表中查找

3. **设置超时时间**
   - 点击函数名称进入详情
   - 在 "Settings" 中找到 "Timeout"
   - 设置为 **26 秒**（免费版最大）
   - 保存设置

### 3. 优化计算性能（如果仍然超时）

如果 26 秒仍然不够，可以考虑以下优化：

#### 方案 A: 分批计算
将计算拆分为多个批次，每次计算部分仓点：

```typescript
// 伪代码示例
async function calculateInBatches(locationRows: LocationRow[], batchSize = 5) {
  for (let i = 0; i < locationRows.length; i += batchSize) {
    const batch = locationRows.slice(i, i + batchSize)
    await calculateBatch(batch)
    // 可以在这里添加进度更新
  }
}
```

#### 方案 B: 异步后台任务
使用队列系统（如 Netlify Background Functions）在后台执行计算：

1. API 接收请求，立即返回
2. 触发后台任务执行计算
3. 前端轮询或使用 WebSocket 获取结果

#### 方案 C: 优化数据库查询
- 添加适当的索引
- 使用批量查询减少数据库往返
- 缓存常用查询结果

## 监控和调试

### 查看函数日志

1. 在 Netlify 控制台进入 "Functions" → "Logs"
2. 查看函数执行日志，确认：
   - 函数是否超时
   - 是否有错误信息
   - 执行时间

### 添加性能监控

在代码中添加性能监控：

```typescript
const startTime = Date.now()
// ... 执行计算 ...
const duration = Date.now() - startTime
console.log(`计算耗时: ${duration}ms`)
```

## 常见错误

### 502 Bad Gateway
- **原因**: 函数超时或崩溃
- **解决**: 增加超时时间或优化代码

### 504 Gateway Timeout
- **原因**: 函数执行时间超过限制
- **解决**: 增加 `maxDuration` 或优化计算逻辑

### 内存不足
- **原因**: 函数使用内存超过限制
- **解决**: 优化内存使用，分批处理数据

## 当前配置

- **函数超时**: 26 秒（代码层面已配置）
- **内存限制**: 默认 1024MB（可在控制台调整）
- **执行环境**: Node.js 20

## 下一步

1. ✅ 代码已添加 `maxDuration = 26`
2. ⏳ 在 Netlify 控制台验证函数超时设置
3. ⏳ 监控函数执行日志
4. ⏳ 如果仍然超时，考虑性能优化方案

