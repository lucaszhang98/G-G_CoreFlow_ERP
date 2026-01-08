"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Database, Upload, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { migrateLocalStorageToDatabase } from "@/lib/table/view-manager"

export function MigrateViewsClient() {
  const [migrating, setMigrating] = React.useState(false)
  const [result, setResult] = React.useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const [localViewsCount, setLocalViewsCount] = React.useState(0)

  // 检查 localStorage 中有多少视图
  React.useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('table_views_'))
      let count = 0
      
      keys.forEach(key => {
        try {
          const stored = localStorage.getItem(key)
          if (stored) {
            const data = JSON.parse(stored)
            const views = Array.isArray(data) ? data : (data.views || [])
            count += views.length
          }
        } catch (error) {
          console.error(`解析 ${key} 失败:`, error)
        }
      })
      
      setLocalViewsCount(count)
    } catch (error) {
      console.error('检查本地视图失败:', error)
    }
  }, [])

  const handleMigrate = async () => {
    setMigrating(true)
    setResult(null)
    
    try {
      const migrationResult = await migrateLocalStorageToDatabase()
      setResult(migrationResult)
      
      if (migrationResult.success > 0) {
        toast.success(`成功迁移 ${migrationResult.success} 个视图`)
      }
      
      if (migrationResult.failed > 0) {
        toast.error(`${migrationResult.failed} 个视图迁移失败`)
      }
      
      if (migrationResult.success === 0 && migrationResult.failed === 0) {
        toast.info('没有找到需要迁移的视图')
      }
    } catch (error: any) {
      console.error('迁移失败:', error)
      toast.error(error.message || '迁移过程发生错误')
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 说明卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            迁移说明
          </CardTitle>
          <CardDescription>
            升级到数据库存储后，需要将现有的本地视图配置迁移到数据库
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">为什么要迁移？</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>数据库存储：视图配置保存在服务器，永不丢失</li>
              <li>跨设备同步：在任何设备登录都能看到自己的视图</li>
              <li>多用户隔离：每个用户的视图配置完全独立</li>
              <li>备份恢复：支持数据库备份和恢复</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">迁移过程</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>读取浏览器本地存储（localStorage）中的视图数据</li>
              <li>逐个上传到数据库，关联到当前登录用户</li>
              <li>保留原有的视图名称、列配置和默认状态</li>
              <li>迁移成功后，本地数据会自动清除（作为缓存保留）</li>
            </ol>
          </div>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>注意事项</AlertTitle>
            <AlertDescription className="text-sm space-y-1">
              <p>• 确保已登录系统</p>
              <p>• 迁移过程中请勿关闭浏览器</p>
              <p>• 如果迁移失败，本地数据不会丢失，可以重试</p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>当前状态</CardTitle>
          <CardDescription>检测到的本地视图数量</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">本地存储的视图配置</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">{localViewsCount}</span>
                <span className="text-muted-foreground">个视图</span>
              </div>
            </div>
            
            <Button 
              onClick={handleMigrate}
              disabled={migrating || localViewsCount === 0}
              size="lg"
              className="gap-2"
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  迁移中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  开始迁移
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结果卡片 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              迁移结果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">成功</p>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    {result.success}
                  </Badge>
                  <span className="text-sm text-muted-foreground">个视图</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">失败</p>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    {result.failed}
                  </Badge>
                  <span className="text-sm text-muted-foreground">个视图</span>
                </div>
              </div>
            </div>
            
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>错误详情</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                    {result.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {result.success > 0 && result.failed === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle>迁移成功！</AlertTitle>
                <AlertDescription>
                  所有视图已成功迁移到数据库。现在你可以在任何设备上看到这些视图配置了。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

