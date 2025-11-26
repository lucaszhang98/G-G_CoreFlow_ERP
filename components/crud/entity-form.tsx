/**
 * 通用实体表单组件
 */

"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EntityConfig, FieldConfig } from "@/lib/crud/types"
import { getSchema } from "@/lib/crud/schema-loader"
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface EntityFormProps<T = any> {
  data?: T | null
  config: EntityConfig
  onSuccess: () => void
  onCancel: () => void
}

export function EntityForm<T = any>({ data, config, onSuccess, onCancel }: EntityFormProps<T>) {
  const [loading, setLoading] = React.useState(false)
  const isEditing = !!data

  // 动态加载 schema
  const schema = React.useMemo(() => {
    return getSchema(config.schemaName, isEditing ? 'update' : 'create')
  }, [config.schemaName, isEditing])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(schema as any) as any,
    defaultValues: data ? (data as any) : {},
  })

  const onSubmit = async (formData: any) => {
    try {
      setLoading(true)

      // 获取 ID 字段名（支持自定义 ID 字段）
      const idField = config.idField || 'id'
      const id = isEditing ? (data as any)[idField] : null
      const url = isEditing ? `${config.apiPath}/${id}` : config.apiPath
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  // 渲染字段
  const renderField = (fieldKey: string) => {
    const fieldConfig = config.fields[fieldKey]
    if (!fieldConfig) return null

    const fieldValue = watch(fieldKey)

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
            </Label>
            <Input
              id={fieldKey}
              type="number"
              step={fieldConfig.type === 'currency' ? '0.01' : '1'}
              {...register(fieldKey, { valueAsNumber: true })}
              placeholder={fieldConfig.placeholder}
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

      case 'select':
        return (
          <div key={fieldKey} className="space-y-2">
            <Label htmlFor={fieldKey}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={fieldValue || ''}
              onValueChange={(value) => setValue(fieldKey, value)}
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
            </Select>
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
        // 关系字段需要特殊处理，这里先跳过，后续实现
        return null

      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {config.formFields.map((fieldKey) => {
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
