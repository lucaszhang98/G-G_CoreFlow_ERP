/**
 * 视图配置迁移工具
 * 用于将 localStorage 中的旧视图数据迁移到数据库
 */

import { MigrateViewsClient } from './migrate-views-client'

export const metadata = {
  title: '视图配置迁移 | 系统设置',
  description: '将本地存储的视图配置迁移到数据库',
}

export default function MigrateViewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">视图配置迁移</h1>
        <p className="text-muted-foreground mt-2">
          将浏览器本地存储（localStorage）中的表格视图配置迁移到数据库，实现跨设备同步
        </p>
      </div>
      
      <MigrateViewsClient />
    </div>
  )
}

