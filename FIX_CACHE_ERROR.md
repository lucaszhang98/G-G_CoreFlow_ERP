# 修复 "cached plan must not change result type" 错误

## 问题原因
当数据库 schema 发生变化（添加/删除字段）后，PostgreSQL 的连接池中可能缓存了旧的查询计划，导致查询失败。

## 解决方案

### 方法 1：重启开发服务器（推荐）
```bash
# 停止当前运行的开发服务器（Ctrl+C）
# 然后重新启动
cd web
npm run dev
```

### 方法 2：清除 Next.js 缓存
```bash
cd web
rm -rf .next
npm run dev
```

### 方法 3：如果问题持续存在
1. 检查数据库连接池设置
2. 尝试断开并重新连接数据库
3. 重启 PostgreSQL 服务（如果可能）

## 已完成的修复
- ✅ 已清除 `.next` 缓存
- ✅ 已更新查询代码以包含 `unbooked_pallet_count` 字段
- ✅ Prisma schema 已同步到数据库

## 下一步
请重启开发服务器，错误应该会消失。

