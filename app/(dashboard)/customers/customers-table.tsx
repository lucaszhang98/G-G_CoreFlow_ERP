/**
 * 客户表格组件（Client Component）
 */

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DataTable } from "@/components/tables/data-table-example"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Eye } from "lucide-react"

interface Customer {
  id: bigint
  code: string
  name: string
  company_name: string | null
  status: string | null
  credit_limit: number | null
  created_at: Date | null
  orders?: any[]
}

interface CustomersTableProps {
  initialData: Customer[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function CustomersTable({ initialData, pagination }: CustomersTableProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)

  const columns = [
    {
      key: "code",
      label: "客户编码",
    },
    {
      key: "name",
      label: "客户名称",
    },
    {
      key: "company_name",
      label: "公司名称",
      render: (value: string | null) => value || "-",
    },
    {
      key: "status",
      label: "状态",
      render: (value: string | null) => (
        <Badge variant={value === "active" ? "default" : "secondary"}>
          {value === "active" ? "活跃" : "停用"}
        </Badge>
      ),
    },
    {
      key: "credit_limit",
      label: "信用额度",
      render: (value: number | null) =>
        value ? `¥${value.toLocaleString()}` : "-",
    },
    {
      key: "orders",
      label: "订单数",
      render: (value: any[]) => value?.length || 0,
    },
    {
      key: "created_at",
      label: "创建时间",
      render: (value: Date | null) =>
        value ? new Date(value).toLocaleDateString("zh-CN") : "-",
    },
  ]

  const handleEdit = (row: Customer) => {
    router.push(`/dashboard/customers/${row.id}/edit`)
  }

  const handleDelete = async (row: Customer) => {
    if (!confirm(`确定要删除客户 "${row.name}" 吗？`)) {
      return
    }

    try {
      const response = await fetch(`/api/customers/${row.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // 刷新数据
        router.refresh()
      } else {
        alert("删除失败")
      }
    } catch (error) {
      console.error("删除客户失败:", error)
      alert("删除失败")
    }
  }

  const handleView = (row: Customer) => {
    router.push(`/dashboard/customers/${row.id}`)
  }

  return (
    <DataTable
      data={data}
      columns={columns}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onCreate={() => router.push("/dashboard/customers/new")}
      searchable={true}
      searchPlaceholder="搜索客户编码、名称..."
    />
  )
}

