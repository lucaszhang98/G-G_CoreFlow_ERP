/**
 * 通用实体表单组件
 */

"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EntityConfig, FieldConfig } from "@/lib/crud/types"
import { getSchema } from "@/lib/crud/schema-loader"
import { filterAuditFields } from "@/lib/crud/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SelectWithClear } from "@/components/ui/select-with-clear"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { LocationSelect } from "@/components/ui/location-select"

// 关系字段选择组件（用于 customers, users, carriers 等）
function RelationSelectField({
  fieldKey,
  actualFieldKey,
  fieldConfig,
  fieldValue,
  setValue,
  errors,
}: {
  fieldKey: string
  actualFieldKey: string
  fieldConfig: FieldConfig
  fieldValue: any
  setValue: (name: string, value: any, options?: any) => void
  errors: any
}) {
  const [relationOptions, setRelationOptions] = React.useState<Array<{ label: string; value: string }>>([])
  const [loadingOptions, setLoadingOptions] = React.useState(false)
  
  React.useEffect(() => {
    const loadOptions = async () => {
      if (!fieldConfig.relation) return
      
      setLoadingOptions(true)
      try {
        const modelName = fieldConfig.relation.model
        const apiPath = `/api/${modelName}?unlimited=true`
        
        const response = await fetch(apiPath)
        if (!response.ok) {
          throw new Error(`加载${fieldConfig.label}选项失败`)
        }
        
        const data = await response.json()
        let items: any[] = []
        if (Array.isArray(data)) {
          items = data
        } else if (data.data && Array.isArray(data.data)) {
          items = data.data
        } else if (data.items && Array.isArray(data.items)) {
          items = data.items
        }
        
        const displayField = fieldConfig.relation.displayField || 'name'
        const valueField = fieldConfig.relation.valueField || 'id'
        
        const options = items
          .filter((item: any) => {
            const val = item[valueField] || item.id
            return val != null && val !== ''
          })
          .map((item: any) => {
            const label = item[displayField] || String(item[valueField] || '')
            const value = String(item[valueField] || item.id || '')
            return { label, value }
          })
        
        setRelationOptions(options)
      } catch (error) {
        console.error(`加载${fieldConfig.label}选项失败:`, error)
        toast.error(`加载${fieldConfig.label}选项失败`)
      } finally {
        setLoadingOptions(false)
      }
    }
    
    loadOptions()
  }, [fieldConfig.relation, fieldConfig.label])
  
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldKey}>
        {fieldConfig.label}
        {fieldConfig.required && <span className="text-red-500">*</span>}
      </Label>
      <SelectWithClear
        value={fieldValue || null}
        onValueChange={(value) => setValue(fieldKey, value)}
        disabled={loadingOptions}
        allowClear={!fieldConfig.required} // 必填字段不允许清空
      >
        <SelectTrigger id={fieldKey}>
          <SelectValue placeholder={loadingOptions ? '加载中...' : (fieldConfig.placeholder || `请选择${fieldConfig.label}`)} />
        </SelectTrigger>
        <SelectContent>
          {relationOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectWithClear>
      {errors[fieldKey] && (
        <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
      )}
    </div>
  )
}

interface EntityFormProps<T = any> {
  data?: T | null
  config: EntityConfig
  onSuccess: () => void
  onCancel: () => void
}

export function EntityForm<T = any>({ data, config, onSuccess, onCancel }: EntityFormProps<T>) {
  const [loading, setLoading] = React.useState(false)
  const [ggLocationId, setGgLocationId] = React.useState<string | null>(null)
  const isEditing = !!data

  // 动态加载 schema
  const schema = React.useMemo(() => {
    return getSchema(config.schemaName, isEditing ? 'update' : 'create')
  }, [config.schemaName, isEditing])

  // 处理表单默认值：确保location字段使用location_id，并转换为字符串
  const processedDefaultValues = React.useMemo(() => {
    const defaults: any = data ? { ...data } : {}
    
    // 如果是创建预约，设置起始地默认值为 GG（location_id=25）
    // 直接使用硬编码的 location_id=25，因为查询可能失败
    if (!isEditing && config.name === 'delivery_appointments') {
      // 优先使用已查询到的 ggLocationId，否则使用硬编码的 25
      defaults.origin_location_id = ggLocationId || '25'
    }
    
    // 处理location字段映射：如果有origin_location_id/destination_location_id，确保表单使用这些值
    // 同时保留origin_location/destination_location用于显示
    // validation schema期望字符串类型，所以需要将数字转换为字符串
    if (defaults.origin_location_id !== undefined && defaults.origin_location_id !== null) {
      defaults.origin_location_id = String(defaults.origin_location_id)
    }
    if (defaults.destination_location_id !== undefined && defaults.destination_location_id !== null) {
      defaults.destination_location_id = String(defaults.destination_location_id)
    }
    if (defaults.location_id !== undefined && defaults.destination_location_id === undefined) {
      // 对于delivery_appointments，location_id就是destination_location_id
      defaults.destination_location_id = defaults.location_id !== null ? String(defaults.location_id) : null
    }
    
    
    return defaults
  }, [data, isEditing, config.name, ggLocationId])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm({
    resolver: zodResolver(schema as any) as any,
    defaultValues: processedDefaultValues,
  })

  // 查询 GG 的 location_id（仅在创建预约时，需要在 useForm 之后）
  // 根据图片显示，GG 的位置ID是 25，但为了通用性，还是通过查询获取
  React.useEffect(() => {
    if (!isEditing && config.name === 'delivery_appointments' && !ggLocationId) {
      // 方法1：先尝试直接通过 location_id=25 查询（如果已知）
      // 方法2：如果失败，再通过搜索查询
      const tryFetchGG = async () => {
        try {
          // 先尝试直接查询 location_id=25（根据图片显示）
          const directResponse = await fetch('/api/locations/25')
          if (directResponse.ok) {
            const directData = await directResponse.json()
            if (process.env.NODE_ENV === 'development') {
              console.log('[EntityForm] 直接查询 location_id=25 结果:', directData)
            }
            // 处理返回数据格式（可能是 {data: {...}} 或直接是对象）
            const locationData = directData.data || directData
            if (locationData && locationData.location_code === 'GG') {
              const locationIdStr = String(locationData.location_id)
              if (process.env.NODE_ENV === 'development') {
                console.log('[EntityForm] 通过直接查询找到 GG location_id:', locationIdStr, 'location_code:', locationData.location_code, 'location_type:', locationData.location_type)
              }
              setGgLocationId(locationIdStr)
              // 立即设置表单值
              setValue('origin_location_id', locationIdStr, { shouldValidate: false, shouldDirty: false })
              // LocationSelect 组件会自动查询位置信息并加载对应类型的位置列表
              // 延迟设置一次，确保 LocationSelect 组件已完全初始化
              setTimeout(() => {
                setValue('origin_location_id', locationIdStr, { shouldValidate: false, shouldDirty: false })
              }, 500)
              return
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('[EntityForm] 直接查询 location_id=25 失败，状态码:', directResponse.status)
            }
          }
        } catch (error) {
          // 直接查询失败，继续使用搜索方式
          if (process.env.NODE_ENV === 'development') {
            console.log('[EntityForm] 直接查询失败，使用搜索方式:', error)
          }
        }

        // 方法2：通过搜索查询（使用更大的 limit 确保能获取到）
        try {
          const searchResponse = await fetch('/api/locations?search=GG&limit=500')
          if (!searchResponse.ok) {
            throw new Error(`HTTP ${searchResponse.status}`)
          }
          const searchData = await searchResponse.json()
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[EntityForm] 搜索 GG location 结果:', searchData)
            if (searchData && searchData.data && Array.isArray(searchData.data)) {
              console.log('[EntityForm] 返回的位置数量:', searchData.data.length)
            }
          }
          
          if (searchData && searchData.data && Array.isArray(searchData.data)) {
            // 查找 location_code 精确匹配 'GG' 的位置
            const ggLocation = searchData.data.find((loc: any) => {
              const code = loc.location_code
              // 精确匹配 'GG'（区分大小写）
              return code === 'GG'
            })
            
            if (ggLocation && ggLocation.location_id) {
              const locationIdStr = String(ggLocation.location_id)
              if (process.env.NODE_ENV === 'development') {
                console.log('[EntityForm] 通过搜索找到 GG location_id:', locationIdStr, 'location_code:', ggLocation.location_code, 'name:', ggLocation.name)
              }
              setGgLocationId(locationIdStr)
              setValue('origin_location_id', locationIdStr, { shouldValidate: false, shouldDirty: false })
            } else {
              // 如果搜索也没找到，使用硬编码的 location_id=25（根据图片显示）
              if (process.env.NODE_ENV === 'development') {
                console.warn('[EntityForm] 搜索未找到 GG，使用硬编码 location_id=25')
              }
              setGgLocationId('25')
              // 延迟一点设置，确保 LocationSelect 组件已初始化
              setTimeout(() => {
                setValue('origin_location_id', '25', { shouldValidate: false, shouldDirty: false })
              }, 200)
            }
          } else {
            // 如果返回数据格式不对，使用硬编码
            if (process.env.NODE_ENV === 'development') {
              console.warn('[EntityForm] 返回数据格式异常，使用硬编码 location_id=25')
            }
            setGgLocationId('25')
            // 延迟一点设置，确保 LocationSelect 组件已初始化
            setTimeout(() => {
              setValue('origin_location_id', '25', { shouldValidate: false, shouldDirty: false })
            }, 200)
          }
        } catch (error) {
          console.error('[EntityForm] 查询 GG location_id 失败:', error)
          // 查询失败时，使用硬编码的 location_id=25 作为后备方案
          if (process.env.NODE_ENV === 'development') {
            console.warn('[EntityForm] 查询失败，使用硬编码 location_id=25 作为后备方案')
          }
          setGgLocationId('25')
          // 延迟一点设置，确保 LocationSelect 组件已初始化
          setTimeout(() => {
            setValue('origin_location_id', '25', { shouldValidate: false, shouldDirty: false })
          }, 200)
        }
      }
      
      tryFetchGG()
    }
  }, [isEditing, config.name, ggLocationId, setValue])

  // 当 GG location_id 加载完成后，更新表单默认值（备用，主要在上面的 useEffect 中设置）
  React.useEffect(() => {
    if (!isEditing && config.name === 'delivery_appointments' && ggLocationId) {
      // 延迟一点设置，确保 LocationSelect 组件已初始化
      const timer = setTimeout(() => {
        setValue('origin_location_id', ggLocationId, { shouldValidate: false, shouldDirty: false })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [ggLocationId, isEditing, config.name, setValue])

  const onSubmit = async (formData: any, e?: React.BaseSyntheticEvent) => {
    // 防止默认表单提交行为
    e?.preventDefault()
    
    try {
      setLoading(true)

      // 获取 ID 字段名（支持自定义 ID 字段）
      const idField = config.idField || 'id'
      const id = isEditing ? (data as any)[idField] : null
      const url = isEditing ? `${config.apiPath}/${id}` : config.apiPath
      const method = isEditing ? 'PUT' : 'POST'

      // 使用getValues()获取所有表单值，包括通过setValue设置的值（如LocationSelect）
      // 因为LocationSelect使用setValue而不是register，所以formData可能不包含这些值
      const allFormValues = getValues()
      
      // 合并formData和allFormValues，优先使用allFormValues（包含通过setValue设置的值）
      const submitData: any = { ...formData, ...allFormValues }
      
      // 处理location字段映射：确保使用正确的字段名，并将数字转换为字符串（validation schema期望字符串）
      // formFields中定义的是origin_location_id和location_id，所以提交时应该使用这些字段名
      // 如果submitData中有origin_location或destination_location（显示用的字段），需要删除它们
      // 只保留origin_location_id和location_id
      if (submitData.origin_location !== undefined) {
        // 如果只有origin_location但没有origin_location_id，说明LocationSelect设置错了字段名
        if (submitData.origin_location_id === undefined) {
          submitData.origin_location_id = submitData.origin_location
        }
        delete submitData.origin_location // 删除显示用的字段
      }
      if (submitData.destination_location !== undefined) {
        // 如果只有destination_location但没有location_id，说明LocationSelect设置错了字段名
        if (submitData.location_id === undefined) {
          submitData.location_id = submitData.destination_location
        }
        delete submitData.destination_location // 删除显示用的字段
      }
      
      // 将location字段的值转换为字符串（validation schema期望字符串类型）
      if (submitData.origin_location_id !== undefined && submitData.origin_location_id !== null) {
        submitData.origin_location_id = String(submitData.origin_location_id)
      }
      if (submitData.location_id !== undefined && submitData.location_id !== null) {
        submitData.location_id = String(submitData.location_id)
      }


      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `${isEditing ? '更新' : '创建'}失败`)
      }

      toast.success(`${config.displayName}${isEditing ? '更新' : '创建'}成功`)
      onSuccess()
    } catch (error: any) {
      console.error(`创建/更新${config.displayName}失败:`, error)
      toast.error(error.message || `${isEditing ? '更新' : '创建'}失败`)
    } finally {
      setLoading(false)
    }
  }

  // 创建稳定的location onChange回调
  const createLocationOnChange = React.useCallback((fieldKey: string, locationFieldKey: string) => {
    return (val: string | number | null) => {
      // fieldKey是formFields中的字段名（如origin_location_id或location_id），应该直接使用
      // validation schema期望字符串类型，所以需要将数字转换为字符串
      const stringValue = val !== null && val !== undefined ? String(val) : null
      setValue(fieldKey, stringValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    }
  }, [setValue])

  // 渲染字段
  const renderField = (fieldKey: string) => {
    // 处理 location_id 字段映射：origin_location_id -> origin_location, location_id -> destination_location
    let actualFieldKey = fieldKey
    let fieldConfig = config.fields[fieldKey]
    
    // 处理 customer_id -> customer 映射
    // 优先使用 customer_id 的配置（如果存在），否则回退到 customer
    if (fieldKey === 'customer_id') {
      if (config.fields['customer_id']) {
        // 如果 customer_id 配置存在，直接使用它
        fieldConfig = config.fields['customer_id']
        actualFieldKey = 'customer_id'
      } else if (config.fields['customer']) {
        // 否则回退到 customer 配置
        fieldConfig = config.fields['customer']
        actualFieldKey = 'customer'
      }
    }
    
    // 强制映射 location_id 字段（无论 fieldConfig 是否存在，与批量编辑逻辑一致）
    if (fieldKey === 'location_id') {
      fieldConfig = config.fields['destination_location']
      actualFieldKey = 'destination_location'
    } else if (fieldKey === 'origin_location_id') {
      fieldConfig = config.fields['origin_location']
      actualFieldKey = 'origin_location'
    } else if (!fieldConfig && fieldKey.endsWith('_location_id')) {
      // 其他 location_id 字段的通用映射
      const baseKey = fieldKey.replace('_location_id', '_location')
      fieldConfig = config.fields[baseKey]
      if (fieldConfig) {
        actualFieldKey = baseKey
      }
    }
    
    if (!fieldConfig) return null

    // 对于location类型字段，优先读取原始字段名（location_id）的值
    // 注意：fieldKey 是 formFields 中的字段名（如 location_id），actualFieldKey 是映射后的字段名（如 destination_location）
    // 对于 relation 类型字段（如 customer_id），也需要使用 fieldKey 来读取值
    let fieldValue: any = null
    if (fieldConfig.type === 'location') {
      // 对于 location 类型字段，始终使用 fieldKey（formFields 中的字段名）来读取值
      // 因为 LocationSelect 的 onChange 会设置 fieldKey 的值
      fieldValue = watch(fieldKey)
    } else if (fieldConfig.type === 'relation' && fieldKey !== actualFieldKey) {
      // 对于 relation 类型字段，如果 fieldKey 和 actualFieldKey 不同（如 customer_id vs customer），使用 fieldKey 读取值
      fieldValue = watch(fieldKey)
    } else {
      fieldValue = watch(actualFieldKey)
    }

    switch (fieldConfig.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type={fieldConfig.type === 'email' ? 'email' : fieldConfig.type === 'phone' ? 'tel' : 'text'}
              {...register(fieldKey)}
              placeholder={fieldConfig.placeholder}
            />
            {errors[fieldKey] && (
              <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'number':
      case 'currency':
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
              {fieldConfig.readonly || fieldConfig.computed ? (
                <span className="text-xs text-muted-foreground ml-2">(自动计算)</span>
              ) : null}
            </Label>
            <Input
              id={fieldKey}
              type="number"
              step={fieldConfig.type === 'currency' ? '0.01' : '1'}
              {...register(fieldKey, { valueAsNumber: true })}
              placeholder={fieldConfig.placeholder}
              disabled={fieldConfig.readonly || fieldConfig.computed}
              className={fieldConfig.readonly || fieldConfig.computed ? 'bg-muted cursor-not-allowed' : ''}
            />
            {errors[fieldKey] && (
              <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'date':
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type="date"
              {...register(fieldKey)}
            />
            {errors[fieldKey] && (
              <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'datetime':
        // 处理日期时间字段：使用 datetime-local 输入类型
        // 格式：YYYY-MM-DDTHH:mm
        // 对于 confirmed_start 字段，使用日期+小时选择器（分钟固定为00）
        const isConfirmedStart = fieldKey === 'confirmed_start'
        const datetimeValue = fieldValue 
          ? (fieldValue instanceof Date 
            ? fieldValue.toISOString().slice(0, 16) 
            : typeof fieldValue === 'string' 
            ? fieldValue.slice(0, 16) 
            : fieldValue)
          : ''
        
        // 如果是 confirmed_start，使用日期+小时选择器
        if (isConfirmedStart) {
          // 解析日期和小时
          let datePart = ''
          let hourPart = '00'
          if (datetimeValue) {
            const parts = datetimeValue.split('T')
            datePart = parts[0] || ''
            if (parts[1]) {
              hourPart = parts[1].split(':')[0] || '00'
            }
          }
          
          // 生成0-23小时选项
          const hourOptions = Array.from({ length: 24 }, (_, i) => {
            const hour = String(i).padStart(2, '0')
            return { label: `${hour}:00`, value: hour }
          })
          
          return (
            <div key={fieldKey} className="space-y-2">
              <Label htmlFor={fieldKey}>
                {fieldConfig.label}
                {fieldConfig.required && <span className="text-red-500">*</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`${fieldKey}_date`}
                  type="date"
                  value={datePart}
                  onChange={(e) => {
                    const newDate = e.target.value
                    const newValue = newDate ? `${newDate}T${hourPart}:00` : null
                    setValue(fieldKey, newValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
                  }}
                  className="flex-1"
                />
                <Select
                  value={hourPart}
                  onValueChange={(newHour) => {
                    const newValue = datePart ? `${datePart}T${newHour}:00` : null
                    setValue(fieldKey, newValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
                  }}
                >
                  <SelectTrigger id={`${fieldKey}_hour`} className="w-32">
                    <SelectValue placeholder="选择小时" />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors[fieldKey] && (
                <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
              )}
            </div>
          )
        }
        
        // 其他日期时间字段使用标准的 datetime-local 输入
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={fieldKey}
              type="datetime-local"
              value={datetimeValue}
              onChange={(e) => {
                const value = e.target.value || null
                setValue(fieldKey, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
              }}
            />
            {errors[fieldKey] && (
              <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
            </Label>
            <SelectWithClear
              value={fieldValue || null}
              onValueChange={(value) => setValue(fieldKey, value)}
              allowClear={!fieldConfig.required} // 必填字段不允许清空
            >
              <SelectTrigger id={fieldKey}>
                <SelectValue placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`} />
              </SelectTrigger>
              <SelectContent>
                {fieldConfig.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectWithClear>
            {errors[fieldKey] && (
              <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={fieldKey}
              {...register(fieldKey)}
              placeholder={fieldConfig.placeholder}
            />
            {errors[fieldKey] && (
              <p className="text-sm text-red-500">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'relation':
        // 处理关联字段（如 contact）
        if (fieldKey === 'contact' && fieldConfig.relation?.model === 'contact_roles') {
          const contactValue = watch(fieldKey) || {}
          return (
            <div key={fieldKey} className="space-y-4 border-t pt-4 mt-4">
              <h3 className="text-lg font-semibold">联系人信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_name`}>联系人姓名</Label>
                  <Input
                    id={`${fieldKey}_name`}
                    {...register(`${fieldKey}.name`)}
                    placeholder="请输入联系人姓名"
                  />
                  {errors[fieldKey] && (errors[fieldKey] as any).name && (
                    <p className="text-sm text-red-500">{(errors[fieldKey] as any).name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_phone`}>联系电话</Label>
                  <Input
                    id={`${fieldKey}_phone`}
                    type="tel"
                    {...register(`${fieldKey}.phone`)}
                    placeholder="请输入联系电话"
                  />
                  {errors[fieldKey] && (errors[fieldKey] as any).phone && (
                    <p className="text-sm text-red-500">{(errors[fieldKey] as any).phone.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_email`}>邮箱</Label>
                  <Input
                    id={`${fieldKey}_email`}
                    type="email"
                    {...register(`${fieldKey}.email`)}
                    placeholder="请输入邮箱"
                  />
                  {errors[fieldKey] && (errors[fieldKey] as any).email && (
                    <p className="text-sm text-red-500">{(errors[fieldKey] as any).email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_address_line1`}>地址（第一行）</Label>
                  <Input
                    id={`${fieldKey}_address_line1`}
                    {...register(`${fieldKey}.address_line1`)}
                    placeholder="请输入地址"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_address_line2`}>地址（第二行）</Label>
                  <Input
                    id={`${fieldKey}_address_line2`}
                    {...register(`${fieldKey}.address_line2`)}
                    placeholder="请输入地址（可选）"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_city`}>城市</Label>
                  <Input
                    id={`${fieldKey}_city`}
                    {...register(`${fieldKey}.city`)}
                    placeholder="请输入城市"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_state`}>省/州</Label>
                  <Input
                    id={`${fieldKey}_state`}
                    {...register(`${fieldKey}.state`)}
                    placeholder="请输入省/州"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_postal_code`}>邮编</Label>
                  <Input
                    id={`${fieldKey}_postal_code`}
                    {...register(`${fieldKey}.postal_code`)}
                    placeholder="请输入邮编"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${fieldKey}_country`}>国家</Label>
                  <Input
                    id={`${fieldKey}_country`}
                    {...register(`${fieldKey}.country`)}
                    placeholder="请输入国家"
                  />
                </div>
              </div>
            </div>
          )
        }
        // 处理 locations 关联字段（使用 LocationSelect 组件）
        if (fieldConfig.relation?.model === 'locations') {
          return (
            <div key={fieldKey} className="space-y-2">
              <Label htmlFor={fieldKey} className="text-sm font-medium text-foreground">
                {fieldConfig.label}
                {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <LocationSelect
                value={fieldValue || null}
                onChange={(val) => setValue(fieldKey, val)}
                placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
                // 不传递className，使用LocationSelect组件的默认统一样式
              />
              {errors[fieldKey] && (
                <p className="text-sm text-red-500 mt-1">{(errors[fieldKey] as any)?.message}</p>
              )}
            </div>
          )
        }
        // 处理其他关联字段（如 customers, users, carriers 等）
        // 使用 RelationSelectField 组件
        // 注意：对于 customer_id 字段，需要使用 fieldKey（customer_id）来设置值，但使用 actualFieldKey（customer）来读取配置
        return <RelationSelectField
          key={fieldKey}
          fieldKey={fieldKey}
          actualFieldKey={actualFieldKey}
          fieldConfig={fieldConfig}
          fieldValue={watch(fieldKey)}
          setValue={setValue}
          errors={errors}
        />

      case 'location':
        // 位置选择字段（使用 LocationSelect 组件）
        // 对于location类型字段，fieldKey可能是origin_location_id或location_id（来自formFields）
        // 但fields定义的是origin_location或destination_location
        // 所以需要确保使用正确的字段名：如果fieldKey是origin_location_id，就使用origin_location_id；如果是location_id，就使用location_id
        // locationFieldKey应该就是fieldKey本身（因为formFields中已经是_id结尾的字段名）
        const locationFieldKey = fieldKey // formFields中已经是_id结尾的字段名，直接使用
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey} className="text-sm font-medium text-foreground">
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <LocationSelect
              value={fieldValue || null}
              onChange={createLocationOnChange(fieldKey, locationFieldKey)}
              placeholder={fieldConfig.placeholder || `请选择${fieldConfig.label}`}
              locationType={(fieldConfig as any).locationType} // 传递配置中的 locationType（如 'warehouse'）
              // 不传递className，使用LocationSelect组件的默认统一样式
            />
            {errors[locationFieldKey] && (
              <p className="text-sm text-red-500 mt-1">{(errors[locationFieldKey] as any)?.message}</p>
            )}
            {locationFieldKey !== fieldKey && errors[fieldKey] && (
              <p className="text-sm text-red-500 mt-1">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      case 'boolean':
        return (
          <div key={fieldKey} className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                id={fieldKey}
                type="checkbox"
                checked={fieldValue === true || fieldValue === 'true'}
                onChange={(e) => setValue(fieldKey, e.target.checked, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor={fieldKey} className="text-sm font-medium text-foreground cursor-pointer">
                {fieldConfig.label}
                {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
            {errors[fieldKey] && (
              <p className="text-sm text-red-500 mt-1">{(errors[fieldKey] as any)?.message}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  // 过滤掉审计字段（ID、created_by、updated_by、created_at、updated_at）
  // 这些字段由系统自动维护，用户不能手动更改
  const userEditableFields = filterAuditFields(config.formFields, config.idField)

  // 添加表单提交的错误处理
  const onError = (errors: any) => {
    console.error('[EntityForm] 表单验证失败:', errors)
    toast.error('请检查表单输入是否正确')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4">
      {userEditableFields.map((fieldKey) => {
        // 编辑模式下，某些字段可能不需要显示（如 password）
        if (isEditing && fieldKey === 'password') {
          return null
        }
        return renderField(fieldKey)
      })}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? '更新' : '创建'}
        </Button>
      </div>
    </form>
  )
}
