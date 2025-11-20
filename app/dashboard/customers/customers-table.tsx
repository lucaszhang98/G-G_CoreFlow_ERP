"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Eye, Trash2, Plus } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CustomerForm } from "./customer-form"
import { toast } from "sonner"

interface Customer {
  id: string
  code: string
  name: string
  company_name: string | null
  status: string | null
  credit_limit: string | null
  contact?: {
    name: string
    phone: string | null
    email: string | null
  } | null
  created_at: string | null
  updated_at: string | null
}

export function CustomersTable() {
  const router = useRouter()
  const [data, setData] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [openDialog, setOpenDialog] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null)
  
  // 分页和排序状态
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [total, setTotal] = React.useState(0)
  const [sort, setSort] = React.useState('code')
  const [order, setOrder] = React.useState<'asc' | 'desc'>('asc')
  
  // 初始排序状态：按客户代码升序
  const [sorting, setSorting] = React.useState([{ id: 'code', desc: false }])

  // 获取客户列表
  const fetchCustomers = React.useCallback(async (currentPage: number, currentPageSize: number, currentSort: string, currentOrder: 'asc' | 'desc') => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/customers?page=${currentPage}&limit=${currentPageSize}&sort=${currentSort}&order=${currentOrder}`
      )
      if (!response.ok) throw new Error("获取客户列表失败")
      const result = await response.json()
      setData(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch (error) {
      console.error("获取客户列表失败:", error)
      toast.error("获取客户列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  React.useEffect(() => {
    fetchCustomers(page, pageSize, sort, order)
  }, [fetchCustomers, page, pageSize, sort, order])

  // 处理排序状态变化
  const handleSortingChange = (newSorting: Array<{ id: string; desc: boolean }>) => {
    // 更新 sorting 状态，确保图标显示正确
    setSorting(newSorting)
    
    if (newSorting.length > 0) {
      const sortItem = newSorting[0]
      setSort(sortItem.id)
      setOrder(sortItem.desc ? 'desc' : 'asc')
      setPage(1) // 排序时重置到第一页
    } else {
      // 如果没有排序，使用默认排序
      setSort('code')
      setOrder('asc')
      setPage(1)
      // 同步 sorting 状态为默认排序
      setSorting([{ id: 'code', desc: false }])
    }
  }

  // 处理创建
  const handleCreate = () => {
    setOpenDialog(true)
  }


  // 处理查看详情
  const handleView = (customer: Customer) => {
    router.push(`/dashboard/customers/${customer.id}`)
  }

  // 处理删除
  const handleDelete = (customer: Customer) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!customerToDelete) return

    try {
      const response = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "删除失败")
      }

      toast.success("客户删除成功")
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
      fetchCustomers(page, pageSize, sort, order)
    } catch (error: any) {
      console.error("删除客户失败:", error)
      toast.error(error.message || "删除客户失败")
    }
  }

  // 表单提交成功回调
  const handleFormSuccess = () => {
    setOpenDialog(false)
    fetchCustomers(page, pageSize, sort, order)
  }

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "code",
      header: "客户代码",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("code")}</div>
      ),
    },
    {
      accessorKey: "name",
      header: "客户名称",
      enableSorting: true,
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "company_name",
      header: "公司名称",
      cell: ({ row }) => {
        const companyName = row.getValue("company_name") as string | null
        return <div>{companyName || "-"}</div>
      },
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => {
        const status = row.getValue("status") as string | null
        return (
          <Badge variant={status === "active" ? "default" : "secondary"}>
            {status === "active" ? "活跃" : "停用"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "credit_limit",
      header: "信用额度",
      cell: ({ row }) => {
        const creditLimit = row.getValue("credit_limit")
        
        // 处理 null、undefined 和空字符串
        if (creditLimit === null || creditLimit === undefined || creditLimit === "") {
          return <div className="text-muted-foreground">-</div>
        }
        
        // 处理数字或字符串类型
        let numValue: number
        if (typeof creditLimit === 'number') {
          numValue = creditLimit
        } else {
          const strValue = String(creditLimit).trim()
          if (strValue === "" || strValue === "null" || strValue === "undefined") {
            return <div className="text-muted-foreground">-</div>
          }
          numValue = parseFloat(strValue)
        }
        
        if (isNaN(numValue)) {
          return <div className="text-muted-foreground">-</div>
        }
        
        // 显示金额，包括 0 值
        return (
          <div className="font-medium">
            ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )
      },
    },
    {
      accessorKey: "contact",
      header: "联系人",
      cell: ({ row }) => {
        const contact = row.getValue("contact") as Customer["contact"]
        const contactName = contact?.name
        return (
          <div className={contactName ? "font-medium" : "text-muted-foreground"}>
            {contactName || "-"}
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "创建时间",
      enableSorting: true,
      cell: ({ row }) => {
        const date = row.getValue("created_at") as string | null
        return (
          <div>
            {date ? new Date(date).toLocaleDateString("zh-CN") : "-"}
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const customer = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">打开菜单</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleView(customer)}>
                <Eye className="mr-2 h-4 w-4" />
                查看详情
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(customer)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="搜索客户名称"
        onAdd={handleCreate}
        addButtonLabel="新建客户"
        initialSorting={sorting}
        onSortingChange={handleSortingChange}
        serverSidePagination={true}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newPageSize) => {
          setPageSize(newPageSize)
          setPage(1) // 改变每页条数时重置到第一页
        }}
      />

      {/* 创建对话框 */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建客户</DialogTitle>
            <DialogDescription>
              填写客户基本信息，创建新客户
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            customer={null}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setOpenDialog(false)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除客户 "{customerToDelete?.name}" 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setCustomerToDelete(null)
              }}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
