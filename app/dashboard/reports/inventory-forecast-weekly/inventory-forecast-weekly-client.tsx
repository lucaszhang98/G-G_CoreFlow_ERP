"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, TrendingUp, Calendar, AlertCircle, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateString, addDaysToDateString, getMondayOfWeek } from "@/lib/utils/timezone"

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

interface WeeklyData {
  week_number: number
  week_label: string
  week_start: string
  week_end: string
  starting_inventory: number
  total_inbound: number
  total_outbound: number
  ending_inventory: number
}

interface WeeklyLocationData {
  location_id: string | null
  location_group: string
  location_name: string
  weekly_data: WeeklyData[]
}

export function InventoryForecastWeeklyClient() {
  const [data, setData] = React.useState<WeeklyLocationData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [calculating, setCalculating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastCalculated, setLastCalculated] = React.useState<string | null>(null)
  const [startDate, setStartDate] = React.useState<string | null>(null)

  // 将日数据汇总为周数据
  const aggregateToWeekly = React.useCallback((locationData: LocationData[]): WeeklyLocationData[] => {
    return locationData.map(location => {
      const weeklyData: WeeklyData[] = []
      const dailyData = location.daily_data

      if (dailyData.length === 0) {
        return {
          location_id: location.location_id,
          location_group: location.location_group,
          location_name: location.location_name,
          weekly_data: []
        }
      }

      // 按周分组（假设数据从周一开始，每7天一周）
      for (let weekNum = 0; weekNum < 8; weekNum++) {
        const weekStart = weekNum * 7
        const weekEnd = Math.min(weekStart + 7, dailyData.length)
        const weekDays = dailyData.slice(weekStart, weekEnd)

        if (weekDays.length === 0) break

        // 汇总一周的数据
        // 每周独立计算：只看当周的总入库和总出库，不考虑上周累积
        const total_inbound = weekDays.reduce((sum, day) => sum + day.planned_inbound, 0)
        const total_outbound = weekDays.reduce((sum, day) => sum + day.planned_outbound, 0)
        // 🎯 当周库存 = 当周入库 - 当周出库（每周独立，不累加上周）
        // 例如：上周剩200板，本周入30出20，本周库存 = 30 - 20 = 10（不是210）
        const ending_inventory = total_inbound - total_outbound

        weeklyData.push({
          week_number: weekNum + 1,
          week_label: `第${weekNum + 1}周`,
          week_start: weekDays[0]?.forecast_date || '',
          week_end: weekDays[weekDays.length - 1]?.forecast_date || '',
          starting_inventory: 0,  // 不再使用周初库存（每周独立计算）
          total_inbound,
          total_outbound,
          ending_inventory
        })
      }

      return {
        location_id: location.location_id,
        location_group: location.location_group,
        location_name: location.location_name,
        weekly_data: weeklyData
      }
    })
  }, [])

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 获取服务器当前日期
      const timeResponse = await fetch("/api/system/current-time")
      if (!timeResponse.ok) {
        throw new Error("获取服务器时间失败")
      }
      const timeData = await timeResponse.json()
      const todayString = timeData.date
      
      // 计算本周一
      const mondayString = getMondayOfWeek(todayString)
      const endDateString = addDaysToDateString(mondayString, 55) // 8周 = 56天
      
      console.log('[前端-周预测] 查询数据:', { mondayString, endDateString })
      
      // 查询从本周一开始的56天数据
      const response = await fetch(`/api/reports/inventory-forecast?start_date=${mondayString}&end_date=${endDateString}`)
      if (!response.ok) {
        throw new Error("获取数据失败")
      }
      const result = await response.json()
      console.log('[前端-周预测] API返回的数据:', {
        summary: result.summary,
        dataCount: result.data?.length,
        firstLocationData: result.data?.[0]?.daily_data?.length,
      })
      
      // 将日数据汇总为周数据
      const weeklyData = aggregateToWeekly(result.data || [])
      console.log('[前端-周预测] 汇总后的周数据:', {
        locationsCount: weeklyData.length,
        firstLocationWeeks: weeklyData[0]?.weekly_data?.length
      })
      
      setData(weeklyData)
      setStartDate(mondayString)
      setLastCalculated("刚刚")
    } catch (err: any) {
      setError(err.message || "获取数据失败")
      console.error("获取周预测数据失败:", err)
    } finally {
      setLoading(false)
    }
  }, [aggregateToWeekly])

  const handleCalculate = async () => {
    try {
      setCalculating(true)
      setError(null)
      
      // 从服务器获取当前时间
      const timeResponse = await fetch("/api/system/current-time")
      if (!timeResponse.ok) {
        throw new Error("获取服务器时间失败")
      }
      const timeData = await timeResponse.json()
      
      // 使用服务器返回的时间
      const baseDateString = timeData.date
      const timestampString = timeData.timestamp
      
      console.log('[前端-周预测] 使用服务器时间:', { baseDateString, timestampString })
      
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
      
      // 计算成功后重新获取数据
      await fetchData()
    } catch (err: any) {
      setError(err.message || "计算失败")
      console.error("计算周预测失败:", err)
    } finally {
      setCalculating(false)
    }
  }

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

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

    let totalInventory = 0
    let totalInbound = 0
    let totalOutbound = 0

    data.forEach(location => {
      location.weekly_data.forEach(week => {
        totalInventory += week.ending_inventory
        totalInbound += week.total_inbound
        totalOutbound += week.total_outbound
      })
    })

    return {
      totalLocations: data.length,
      totalInventory,
      totalInbound,
      totalOutbound,
    }
  }, [data])

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            库存预测 - 周视图
          </h1>
          <p className="text-muted-foreground mt-1">
            未来8周库存预测汇总（从本周一开始）
            {lastCalculated && (
              <span className="ml-2 text-xs">
                · 最后更新: {lastCalculated}
              </span>
            )}
          </p>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                预测周数
              </CardTitle>
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <Calendar className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8 周</div>
              <p className="text-xs text-muted-foreground mt-1">从 {startDate} 开始</p>
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
                  横向为时间（未来8周），纵向为各仓点
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
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((weekNum) => (
                      <TableHead
                        key={weekNum}
                        className="text-center min-w-[170px] font-semibold border-x"
                      >
                        <div className="flex flex-col gap-1.5 py-2">
                          <span className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            第 {weekNum} 周
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
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((weekNum) => {
                          const weekData = locationData.weekly_data.find(w => w.week_number === weekNum)
                          if (!weekData) {
                            return (
                              <TableCell
                                key={weekNum}
                                className="text-center border-x border-slate-100 dark:border-slate-800"
                              >
                                <span className="text-slate-400 dark:text-slate-600">-</span>
                              </TableCell>
                            )
                          }

                          // 判断库存状态：库存预警当 > 100 或 < 0 时
                          const isWarning = weekData.ending_inventory > 100 || weekData.ending_inventory < 0
                          const isNormal = weekData.ending_inventory >= 0 && weekData.ending_inventory <= 100

                          return (
                            <TableCell
                              key={weekNum}
                              className="text-center py-3 border-x border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-all duration-150"
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
                                  {weekData.ending_inventory.toLocaleString()}
                                </div>
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400">
                                    <span className="font-medium">↑</span>
                                    <span className="font-semibold">
                                      {weekData.total_inbound.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                                    <span className="font-medium">↓</span>
                                    <span className="font-semibold">
                                      {weekData.total_outbound.toLocaleString()}
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

