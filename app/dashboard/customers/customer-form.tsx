"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { customerCreateSchema, customerUpdateSchema, CustomerCreateInput, CustomerUpdateInput } from "@/lib/validations/customer"
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
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface Customer {
  id: string
  code: string
  name: string
  company_name?: string | null
  status?: string | null
  credit_limit?: string | null
  contact?: {
    name: string
    phone?: string | null
    email?: string | null
    address_line1?: string | null
    address_line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
}

interface CustomerFormProps {
  customer?: Customer | null
  onSuccess: () => void
  onCancel: () => void
}

export function CustomerForm({ customer, onSuccess, onCancel }: CustomerFormProps) {
  const [loading, setLoading] = React.useState(false)
  const isEditing = !!customer

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    // 使用条件类型处理编辑和创建的不同 schema
    resolver: zodResolver(isEditing ? customerUpdateSchema : customerCreateSchema) as any,
    defaultValues: customer
      ? {
          code: customer.code,
          name: customer.name,
          company_name: customer.company_name || "",
          credit_limit: customer.credit_limit
            ? parseFloat(customer.credit_limit)
            : undefined,
          status: ((customer.status as "active" | "inactive") || "active") as "active" | "inactive",
          contact: customer.contact
            ? {
                name: customer.contact.name || "",
                phone: customer.contact.phone || "",
                email: customer.contact.email || "",
                address_line1: customer.contact.address_line1 || "",
                address_line2: customer.contact.address_line2 || "",
                city: customer.contact.city || "",
                state: customer.contact.state || "",
                postal_code: customer.contact.postal_code || "",
                country: customer.contact.country || "",
              }
            : undefined,
        }
      : {
          status: "active",
        },
  })

  const status = watch("status")

  const onSubmit = async (data: any) => {
    try {
      setLoading(true)

      // 准备提交数据，确保格式正确
      const submitData: any = {
        code: data.code,
        name: data.name,
        status: data.status,
      }

      // 可选字段
      if (data.company_name) {
        submitData.company_name = data.company_name
      }
      if (data.credit_limit !== undefined && data.credit_limit !== null) {
        submitData.credit_limit = data.credit_limit
      }

      // 联系人信息
      // 注意：数据库要求 contact_roles.name 非空，所以只有当提供了 name 时才创建联系人
      // 如果只提供了其他信息（如邮箱、电话）但没有姓名，则不创建联系人
      if (data.contact && data.contact.name) {
        submitData.contact = {
          name: data.contact.name,
          phone: data.contact.phone || undefined,
          email: data.contact.email || undefined,
          address_line1: data.contact.address_line1 || undefined,
          address_line2: data.contact.address_line2 || undefined,
          city: data.contact.city || undefined,
          state: data.contact.state || undefined,
          postal_code: data.contact.postal_code || undefined,
          country: data.contact.country || undefined,
        }
      }

      const url = isEditing ? `/api/customers/${customer!.id}` : "/api/customers"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || errorData.details?.[0]?.message || "操作失败"
        throw new Error(errorMessage)
      }

      toast.success(isEditing ? "客户更新成功" : "客户创建成功")
      onSuccess()
    } catch (error: any) {
      console.error("提交失败:", error)
      toast.error(error.message || "操作失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 基本信息 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="code">
              客户代码 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              {...register("code")}
              disabled={isEditing}
              placeholder="请输入客户代码"
            />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              客户名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="请输入客户名称"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">公司名称</Label>
            <Input
              id="company_name"
              {...register("company_name")}
              placeholder="请输入公司名称"
            />
            {errors.company_name && (
              <p className="text-sm text-destructive">
                {errors.company_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <Select
              value={status}
              onValueChange={(value) => setValue("status", value as "active" | "inactive")}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive">{errors.status.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="credit_limit">信用额度（可选）</Label>
            <Input
              id="credit_limit"
              type="number"
              step="0.01"
              {...register("credit_limit", { valueAsNumber: true })}
              placeholder="留空则默认为 0"
            />
            {errors.credit_limit && (
              <p className="text-sm text-destructive">
                {errors.credit_limit.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 联系人信息 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">联系人信息（可选）</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contact_name">联系人姓名（可选）</Label>
            <Input
              id="contact_name"
              {...register("contact.name")}
              placeholder="请输入联系人姓名（可选）"
            />
            {(errors.contact as any)?.name && (
              <p className="text-sm text-destructive">
                {(errors.contact as any).name?.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">联系电话</Label>
            <Input
              id="contact_phone"
              {...register("contact.phone")}
              placeholder="请输入联系电话"
            />
            {(errors.contact as any)?.phone && (
              <p className="text-sm text-destructive">
                {(errors.contact as any).phone?.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">邮箱（可选）</Label>
            <Input
              id="contact_email"
              type="email"
              {...register("contact.email")}
              placeholder="请输入邮箱（可选）"
            />
            {(errors.contact as any)?.email && (
              <p className="text-sm text-destructive">
                {(errors.contact as any).email?.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_address_line1">地址（第一行）</Label>
            <Input
              id="contact_address_line1"
              {...register("contact.address_line1")}
              placeholder="请输入地址"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_address_line2">地址（第二行）</Label>
            <Input
              id="contact_address_line2"
              {...register("contact.address_line2")}
              placeholder="请输入地址（可选）"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_city">城市</Label>
            <Input
              id="contact_city"
              {...register("contact.city")}
              placeholder="请输入城市"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_state">省/州</Label>
            <Input
              id="contact_state"
              {...register("contact.state")}
              placeholder="请输入省/州"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_postal_code">邮编</Label>
            <Input
              id="contact_postal_code"
              {...register("contact.postal_code")}
              placeholder="请输入邮编"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_country">国家</Label>
            <Input
              id="contact_country"
              {...register("contact.country")}
              placeholder="请输入国家"
            />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "更新" : "创建"}
        </Button>
      </div>
    </form>
  )
}

