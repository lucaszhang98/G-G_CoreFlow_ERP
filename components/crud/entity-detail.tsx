/**
 * 通用实体详情组件
 * 根据 EntityConfig 自动生成详情页面
 */

import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { EntityConfig } from "@/lib/crud/types"
import { Decimal } from "@prisma/client/runtime/library"
import { autoFormatDateField } from "@/lib/utils/date-format"
import { EntityDetailClient } from "./entity-detail-client"
import { serializeBigInt } from "@/lib/api/helpers"

interface EntityDetailProps {
  config: EntityConfig
  id: string | bigint
  data?: any // 如果已经获取了数据，直接传入
}

export async function EntityDetail({ config, id, data: providedData }: EntityDetailProps) {
  // 如果没有提供数据，则从数据库获取
  let data = providedData

  if (!data) {
    const idField = config.idField || 'id'
    const modelName = config.prisma?.model || config.name
    const whereClause: any = {}
    
    // 处理 BigInt ID
    if (idField === 'id' || idField.endsWith('_id')) {
      whereClause[idField] = BigInt(id as string)
    } else {
      whereClause[idField] = id
    }

    // 获取 Prisma 模型（与 api-handler 使用相同的逻辑）
    let prismaModel = (prisma as any)[modelName]
    if (!prismaModel) {
      // 尝试复数形式
      const pluralModel = modelName + 's'
      prismaModel = (prisma as any)[pluralModel]
    }
    if (!prismaModel) {
      notFound()
    }

    // 构建查询
    const queryOptions: any = {
      where: whereClause,
    }

    // 添加关联查询
    if (config.prisma?.include) {
      queryOptions.include = config.prisma.include
    } else if (config.prisma?.select) {
      queryOptions.select = config.prisma.select
    }

    data = await prismaModel.findUnique(queryOptions)

    if (!data) {
      notFound()
    }
  }

  // 使用统一的日期格式化框架（不包含年份）
  const formatDate = (date: Date | string | null) => {
    return autoFormatDateField('', date)
  }

  const formatNumber = (value: number | null | string | Decimal) => {
    if (!value && value !== 0) return "-"
    const numValue = value instanceof Decimal 
      ? Number(value) 
      : typeof value === 'string' 
        ? parseFloat(value) 
        : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  const formatCurrency = (value: number | null | string | Decimal) => {
    if (!value && value !== 0) return "-"
    const numValue = value instanceof Decimal 
      ? Number(value) 
      : typeof value === 'string' 
        ? parseFloat(value) 
        : Number(value)
    if (isNaN(numValue)) return "-"
    return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // 获取字段值
  const getFieldValue = (fieldKey: string, fieldConfig: any) => {
    const value = (data as any)[fieldKey]
    
    if (value === null || value === undefined) {
      return null
    }

    // 根据字段类型格式化
    switch (fieldConfig.type) {
      case 'date':
        // 使用统一的日期格式化框架
        return autoFormatDateField(fieldKey, value)
      case 'number':
        return formatNumber(value)
      case 'currency':
        return formatCurrency(value)
      case 'badge':
        const option = fieldConfig.options?.find((opt: any) => opt.value === value)
        return option ? option.label : value
      case 'relation':
        if (fieldConfig.relation) {
          // 尝试从关联数据中获取
          const relationModelName = fieldConfig.relation.model
          // 查找关联数据（可能是单数或复数形式）
          const relationData = (data as any)[relationModelName] || 
                              (data as any)[relationModelName + 's'] ||
                              (data as any)[fieldKey]
          if (relationData) {
            const displayValue = relationData[fieldConfig.relation.displayField]
            return displayValue || value || null
          }
        }
        return value || null
      default:
        return String(value)
    }
  }

  // 获取显示名称（用于标题）
  const getDisplayName = () => {
    // 优先使用 name 字段，然后是 code 字段，最后是 ID
    const nameField = config.fields['name'] || 
                      config.fields['code'] || 
                      config.fields['trailer_code'] ||
                      config.fields['vehicle_code'] ||
                      config.fields['carrier_code'] ||
                      config.fields[config.idField || 'id']
    if (nameField) {
      const value = getFieldValue(nameField.key, nameField)
      if (value && value !== "-" && value !== null) {
        return String(value)
      }
    }
    return `${config.displayName} #${id}`
  }

  // 获取主键显示值
  const getIdDisplay = () => {
    const idField = config.idField || 'id'
    const idValue = (data as any)[idField]
    return idValue ? idValue.toString() : String(id)
  }

  // 分组字段（基本信息和其他）
  const basicFields: string[] = []
  const otherFields: string[] = []
  
  // 使用 formFields 或 list.columns 来确定要显示的字段
  const fieldsToShow = config.formFields.length > 0 
    ? config.formFields 
    : config.list.columns.filter(col => col !== (config.idField || 'id'))
  
  fieldsToShow.forEach(fieldKey => {
    const field = config.fields[fieldKey]
    if (!field) return
    
    // ID 字段不显示
    if (fieldKey === (config.idField || 'id')) return
    
    // 备注字段单独处理
    if (fieldKey === 'notes' || fieldKey.includes('note') || fieldKey.includes('remark')) {
      otherFields.push(fieldKey)
    } else {
      basicFields.push(fieldKey)
    }
  })
  
  // 如果没有其他字段，确保至少显示基本信息
  if (basicFields.length === 0 && otherFields.length > 0) {
    basicFields.push(...otherFields)
    otherFields.length = 0
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={config.detailPath}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {getDisplayName()}
            </h1>
            <p className="text-muted-foreground mt-2">
              {config.displayName}ID: {getIdDisplay()}
            </p>
          </div>
        </div>
        {/* 编辑按钮 - 如果有更新权限 */}
        {config.permissions.update && config.permissions.update.length > 0 && (
          <EntityDetailClient config={config} data={serializeBigInt(data)} />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本信息 */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>{config.displayName}的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {basicFields.map((fieldKey) => {
                const field = config.fields[fieldKey]
                if (!field) return null

                const value = getFieldValue(fieldKey, field)

                return (
                  <div key={fieldKey}>
                    <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
                    {field.type === 'badge' ? (
                      <div className="mt-1">
                        <Badge variant={value === 'active' || value === 'available' ? 'default' : 'secondary'}>
                          {value || "-"}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-base font-semibold">{value || "-"}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 其他信息（备注等） */}
        {otherFields.length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>其他信息</CardTitle>
              <CardDescription>{config.displayName}的备注和说明</CardDescription>
            </CardHeader>
            <CardContent>
              {otherFields.map((fieldKey) => {
                const field = config.fields[fieldKey]
                if (!field) return null

                const value = getFieldValue(fieldKey, field)

                return (
                  <div key={fieldKey} className="mb-4 last:mb-0">
                    <p className="text-sm font-medium text-muted-foreground mb-2">{field.label}</p>
                    <p className="text-base whitespace-pre-wrap">
                      {value || "暂无"}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

