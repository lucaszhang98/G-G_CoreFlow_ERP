"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, TrendingUp, Calendar, AlertCircle, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateString, addDaysToDateString } from "@/lib/utils/timezone"

interface DailyData {
  forecast_date: string
  day_number: number
  historical_inventory: number
  planned_inbound: number
  planned_outbound: number
  forecast_inventory: number
}

interface LocationData {
  location_id: string | null
  location_group: string
  location_name: string
  daily_data: DailyData[]
}

export function InventoryForecastClient() {
  const [data, setData] = React.useState<LocationData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [calculating, setCalculating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastCalculated, setLastCalculated] = React.useState<string | null>(null)
  const [startDate, setStartDate] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 获取服务器当前日期，用于查询从今天开始的15天数据
      const timeResponse = await fetch("/api/system/current-time")
      if (!timeResponse.ok) {
        throw new Error("获取服务器时间失败")
      }
      const timeData = await timeResponse.json()
      const todayString = timeData.date
      const endDateString = addDaysToDateString(todayString, 14)
      
      console.log('[前端] 查询日预测数据:', { todayString, endDateString })
      
      // 查询从今天开始的15天数据
      const response = await fetch(`/api/reports/inventory-forecast?start_date=${todayString}&end_date=${endDateString}`)
      if (!response.ok) {
        throw new Error("获取数据失败")
      }
      const result = await response.json()
      console.log('[前端] API返回的数据:', {
        summary: result.summary,
        dataCount: result.data?.length,
        firstLocationData: result.data?.[0]?.daily_data?.length,
      })
      setData(result.data || [])
      // 设置基准日期为今天
      console.log('[前端] 设置基准日期:', todayString)
      setStartDate(todayString)
      // 不读取外部时间，使用API返回的计算时间或显示"刚刚"
      // 如果API返回了calculated_at，可以使用它，否则显示"刚刚"
      setLastCalculated("刚刚")
    } catch (err: any) {
      setError(err.message || "获取数据失败")
      console.error("获取库存预测数据失败:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCalculate = async () => {
    try {
      setCalculating(true)
      setError(null)
      
      // 从服务器获取当前时间（确保本地和正式环境使用相同的逻辑）
      // 本地开发：从本地开发服务器获取时间
      // 正式环境：从 Netlify 服务器获取时间
      const timeResponse = await fetch("/api/system/current-time")
      if (!timeResponse.ok) {
        throw new Error("获取服务器时间失败")
      }
      const timeData = await timeResponse.json()
      
      // 使用服务器返回的时间
      const baseDateString = timeData.date
      const timestampString = timeData.timestamp
      
      console.log('[前端] 使用服务器时间:', { baseDateString, timestampString })
      
      const response = await fetch("/api/reports/inventory-forecast/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_date: baseDateString,
          timestamp: timestampString,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "计算失败")
      }
      // 计算完成后刷新数据（先重置 startDate，确保使用新的基准日期）
      setStartDate(null)
      await fetchData()
    } catch (err: any) {
      setError(err.message || "计算失败")
      console.error("计算库存预测失败:", err)
    } finally {
      setCalculating(false)
    }
  }

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // 生成日期列标题（15天）- 使用API返回的基准日期
  const dateColumns = React.useMemo(() => {
    if (!startDate) {
      // 如果还没有获取到基准日期，返回空数组
      return []
    }
    
    const columns = Array.from({ length: 15 }, (_, i) => {
      const dateString = addDaysToDateString(startDate, i)
      const date = new Date(dateString + 'T00:00:00Z') // 解析为UTC日期
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      const weekday = weekdays[date.getUTCDay()]
      const month = date.getUTCMonth() + 1
      const day = date.getUTCDate()
      return {
        date: dateString,
        dayNumber: i + 1,
        dateLabel: `${month}-${day}`,
        weekdayLabel: `星期${weekday}`,
        isToday: i === 0,
        isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
      }
    })
    console.log('[前端] 生成的日期列:', {
      startDate,
      columns: columns.map(c => `${c.dateLabel} (day ${c.dayNumber})`),
    })
    return columns
  }, [startDate])

  // 获取某个仓点某天的数据
  const getDayData = (locationData: LocationData, dayNumber: number) => {
    return locationData.daily_data.find((d) => d.day_number === dayNumber)
  }

  // 获取仓点分组标签颜色
  const getLocationGroupBadge = (group: string) => {
    switch (group) {
      case 'amazon':
        return { label: '亚马逊', bgClass: 'bg-gradient-to-r from-blue-500 to-blue-600', textClass: 'text-white' }
      case 'private_warehouse':
        return { label: '私仓', bgClass: 'bg-gradient-to-r from-purple-500 to-purple-600', textClass: 'text-white' }
      case 'fedex':
        return { label: 'FEDEX', bgClass: 'bg-gradient-to-r from-orange-400 to-orange-500', textClass: 'text-white' }
      case 'ups':
        return { label: 'UPS', bgClass: 'bg-gradient-to-r from-amber-500 to-yellow-500', textClass: 'text-white' }
      case 'hold':
        return { label: '扣货', bgClass: 'bg-gradient-to-r from-rose-500 to-pink-600', textClass: 'text-white' }
      default:
        return { label: group, bgClass: 'bg-gradient-to-r from-gray-500 to-gray-600', textClass: 'text-white' }
    }
  }

  // 计算统计数据
  const stats = React.useMemo(() => {
    if (data.length === 0) return null
    
    let totalLocations = data.length
    let totalInventory = 0
    let totalInbound = 0
    let totalOutbound = 0
    let lowStockLocations = 0

    data.forEach((location) => {
      const todayData = location.daily_data.find((d) => d.day_number === 1)
      if (todayData) {
        totalInventory += todayData.forecast_inventory
        totalInbound += todayData.planned_inbound
        totalOutbound += todayData.planned_outbound
      }
      
      // 库存预警：检查所有天数，只要有任何一天 > 100 或 < 0 就算预警
      const hasWarning = location.daily_data.some(day => 
        day.forecast_inventory > 100 || day.forecast_inventory < 0
      )
      if (hasWarning) {
        lowStockLocations++
      }
    })

    return {
      totalLocations,
      totalInventory,
      totalInbound,
      totalOutbound,
      lowStockLocations,
    }
  }, [data])

  return (
    <div className="space-y-6">
      {/* 页面标题和操作栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                库存预测报表
              </h1>
              <p className="text-muted-foreground mt-1">
                未来15天的库存、入库、出库预测分析
              </p>
            </div>
          </div>
          {lastCalculated && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              最后更新：{lastCalculated}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={handleCalculate}
          disabled={calculating}
          className="shadow-sm hover:shadow-md transition-all"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", calculating && "animate-spin")} />
          {calculating ? "计算中..." : "重新计算"}
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                仓点总数
              </CardTitle>
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLocations}</div>
              <p className="text-xs text-muted-foreground mt-1">个仓点</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总库存
              </CardTitle>
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInventory.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">板数</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                预计入库
              </CardTitle>
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalInbound.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">板数</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                预计出库
              </CardTitle>
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <TrendingUp className="h-4 w-4 text-white rotate-180" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.totalOutbound.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">板数</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                库存预警
              </CardTitle>
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.lowStockLocations}</div>
              <p className="text-xs text-muted-foreground mt-1">个仓点</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据表格 */}
      {loading ? (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-muted-foreground">加载中...</span>
            </div>
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-semibold">暂无数据</p>
                <p className="text-muted-foreground mt-1">请先执行计算以生成预测数据</p>
              </div>
              <Button
                onClick={handleCalculate}
                disabled={calculating}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", calculating && "animate-spin")} />
                开始计算
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">库存预测表格</CardTitle>
                <CardDescription className="mt-1">
                  横向为时间（今天到未来15天），纵向为各仓点
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm">
                {data.length} 个仓点
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:from-slate-100 hover:to-slate-50">
                    <TableHead className="sticky left-0 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 z-20 min-w-[200px] font-bold border-r-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                          <BarChart3 className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-base">仓点</span>
                      </div>
                    </TableHead>
                    {dateColumns.map((col) => (
                      <TableHead
                        key={col.date}
                        className={cn(
                          "text-center min-w-[150px] font-semibold border-x",
                          col.isToday && "bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-800/30",
                          col.isWeekend && !col.isToday && "bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/20"
                        )}
                      >
                        <div className="flex flex-col gap-1.5 py-2">
                          <span className="text-sm font-bold">{col.dateLabel}</span>
                          <span className={cn(
                            "text-xs font-medium",
                            col.isToday && "text-blue-600 dark:text-blue-400",
                            col.isWeekend && !col.isToday && "text-orange-600 dark:text-orange-400",
                            !col.isToday && !col.isWeekend && "text-muted-foreground"
                          )}>
                            {col.weekdayLabel}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((locationData, idx) => {
                    const groupBadge = getLocationGroupBadge(locationData.location_group)
                    return (
                      <TableRow
                        key={`${locationData.location_group}_${locationData.location_id || "null"}`}
                        className={cn(
                          "hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all duration-200",
                          idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/50 dark:bg-slate-900/30"
                        )}
                      >
                        <TableCell className={cn(
                          "sticky left-0 z-10 font-medium border-r-2 border-slate-200 dark:border-slate-700",
                          idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/50 dark:bg-slate-900/30"
                        )}>
                          <div className="flex items-center gap-3 py-1">
                            <Badge
                              className={cn(
                                "shadow-sm hover:shadow-md transition-all px-2.5 py-0.5 text-xs font-semibold",
                                groupBadge.bgClass,
                                groupBadge.textClass
                              )}
                            >
                              {groupBadge.label}
                            </Badge>
                            <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{locationData.location_name}</span>
                          </div>
                        </TableCell>
                        {dateColumns.map((col) => {
                          const dayData = getDayData(locationData, col.dayNumber)
                          if (!dayData) {
                            return (
                              <TableCell
                                key={col.date}
                                className={cn(
                                  "text-center border-x border-slate-100 dark:border-slate-800",
                                  col.isToday && "bg-blue-50/50 dark:bg-blue-950/20",
                                  col.isWeekend && !col.isToday && "bg-amber-50/30 dark:bg-amber-950/10"
                                )}
                              >
                                <span className="text-slate-400 dark:text-slate-600">-</span>
                              </TableCell>
                            )
                          }

                          // 判断库存状态：库存预警当 > 100 或 < 0 时
                          const isWarning = dayData.forecast_inventory > 100 || dayData.forecast_inventory < 0
                          const isNormal = dayData.forecast_inventory >= 0 && dayData.forecast_inventory <= 100

                          return (
                            <TableCell
                              key={col.date}
                              className={cn(
                                "text-center py-3 border-x border-slate-100 dark:border-slate-800",
                                col.isToday && "bg-blue-50/50 dark:bg-blue-950/20",
                                col.isWeekend && !col.isToday && "bg-amber-50/30 dark:bg-amber-950/10",
                                "hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-all duration-150"
                              )}
                            >
                              <div className="flex flex-col gap-2">
                                <div
                                  className={cn(
                                    "text-base font-bold px-2.5 py-1.5 rounded-lg transition-all",
                                    isWarning &&
                                      "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-2 border-red-300 dark:border-red-700",
                                    isNormal &&
                                      "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                  )}
                                >
                                  {dayData.forecast_inventory.toLocaleString()}
                                </div>
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400">
                                    <span className="font-medium">↑</span>
                                    <span className="font-semibold">
                                      {dayData.planned_inbound}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                                    <span className="font-medium">↓</span>
                                    <span className="font-semibold">
                                      {dayData.planned_outbound}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

