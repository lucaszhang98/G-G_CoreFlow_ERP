"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface OrderDetail {
  id: string
  order_id: string | null
  detail_id: string | null
  quantity: number
  volume: number | string | null
  container_volume: number | string | null
  estimated_pallets: number | null
  created_at: string | Date | null
  updated_at: string | Date | null
  created_by: string | null
  updated_by: string | null
  order_detail_item_order_detail_item_detail_idToorder_detail?: OrderDetailItem[]
}

interface OrderDetailItem {
  id: string
  detail_name: string
  sku: string
  description: string | null
  stock_quantity: number | null
  volume: number | string | null
  status: string | null
  fba: string | null
  detail_id: string | null
  created_at: string | Date | null
  updated_at: string | Date | null
  created_by: string | null
  updated_by: string | null
}

interface OrderDetailsTableProps {
  orderId: string
  orderDetails: OrderDetail[]
  onRefresh: () => void
}

export function OrderDetailsTable({
  orderId,
  orderDetails: initialOrderDetails,
  onRefresh,
}: OrderDetailsTableProps) {
  const router = useRouter()
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingDetail, setEditingDetail] = React.useState<OrderDetail | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null)
  const [addDetailDialogOpen, setAddDetailDialogOpen] = React.useState(false)
  const [editSkuDialogOpen, setEditSkuDialogOpen] = React.useState(false)
  const [editingSku, setEditingSku] = React.useState<OrderDetailItem | null>(null)
  const [addSkuDialogOpen, setAddSkuDialogOpen] = React.useState(false)
  const [addSkuDetailId, setAddSkuDetailId] = React.useState<string | null>(null)

  // 确保数据是数组
  const orderDetails = React.useMemo(() => {
    if (!initialOrderDetails || !Array.isArray(initialOrderDetails)) {
      return []
    }
    return initialOrderDetails
  }, [initialOrderDetails])

  const formatNumber = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-"
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 切换展开/收起
  const toggleExpand = (detailId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(detailId)) {
        next.delete(detailId)
      } else {
        next.add(detailId)
      }
      return next
    })
  }

  // 打开编辑弹窗
  const handleEditDetail = (detail: OrderDetail) => {
    setEditingDetail({ ...detail })
    setEditDialogOpen(true)
  }

  // 保存编辑
  const handleSaveEdit = async (data: {
    quantity: number
    volume?: number | null
    container_volume?: number | null
    estimated_pallets?: number | null
  }) => {
    if (!editingDetail) return

    try {
      const response = await fetch(`/api/order-details/${editingDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: data.quantity,
          volume: data.volume,
          container_volume: data.container_volume,
          estimated_pallets: data.estimated_pallets,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || '保存失败')
      }

      toast.success('仓点明细已更新')
      setEditDialogOpen(false)
      setEditingDetail(null)
      onRefresh()
    } catch (error: any) {
      console.error('保存失败:', error)
      toast.error(error.message || '保存失败')
      throw error
    }
  }

  // 删除仓点明细
  const handleDeleteDetail = (detailId: string) => {
    setItemToDelete(detailId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    try {
      const response = await fetch(`/api/order-details/${itemToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || '删除失败')
      }

      toast.success('仓点明细已删除')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      onRefresh()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  // 添加仓点明细
  const handleAddDetail = async (data: {
    quantity: number
    volume?: number | null
    container_volume?: number | null
    estimated_pallets?: number | null
  }) => {
    try {
      const response = await fetch('/api/order-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          ...data,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || '添加失败')
      }

      toast.success('仓点明细已添加')
      setAddDetailDialogOpen(false)
      onRefresh()
    } catch (error: any) {
      console.error('添加失败:', error)
      toast.error(error.message || '添加失败')
      throw error
    }
  }

  if (orderDetails.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setAddDetailDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加仓点明细
          </Button>
        </div>
        <p className="text-muted-foreground text-center py-8">暂无仓点明细</p>
        <AddDetailDialog
          open={addDetailDialogOpen}
          onOpenChange={setAddDetailDialogOpen}
          onSave={handleAddDetail}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 操作按钮 */}
      <div className="flex justify-end">
        <Button onClick={() => setAddDetailDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加仓点明细
        </Button>
      </div>

      {/* 仓点明细表格 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>仓点ID</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>体积</TableHead>
              <TableHead>货柜体积</TableHead>
              <TableHead>预估托盘数</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderDetails.map((detail) => {
              const detailId = detail.id
              const isExpanded = expandedRows.has(detailId)
              const skuItems = detail.order_detail_item_order_detail_item_detail_idToorder_detail || []

              return (
                <React.Fragment key={detailId}>
                  {/* 主行：仓点明细 */}
                  <TableRow>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpand(detailId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{detailId}</TableCell>
                    <TableCell>{formatNumber(detail.quantity)}</TableCell>
                    <TableCell>{formatNumber(detail.volume)}</TableCell>
                    <TableCell>{formatNumber(detail.container_volume)}</TableCell>
                    <TableCell>{formatNumber(detail.estimated_pallets)}</TableCell>
                    <TableCell>{formatDate(detail.created_at)}</TableCell>
                    <TableCell>{formatDate(detail.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditDetail(detail)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDetail(detailId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* 展开行：SKU明细 */}
                  {isExpanded && (
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={9} className="p-0">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">
                              SKU明细 ({skuItems.length})
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAddSkuDetailId(detailId)
                                setAddSkuDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              添加SKU
                            </Button>
                          </div>
                          {skuItems.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>SKU</TableHead>
                                  <TableHead>明细名称</TableHead>
                                  <TableHead>描述</TableHead>
                                  <TableHead>库存数量</TableHead>
                                  <TableHead>体积</TableHead>
                                  <TableHead>状态</TableHead>
                                  <TableHead>FBA</TableHead>
                                  <TableHead className="w-32">操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {skuItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.sku}</TableCell>
                                    <TableCell>{item.detail_name}</TableCell>
                                    <TableCell>{item.description || "-"}</TableCell>
                                    <TableCell>{formatNumber(item.stock_quantity)}</TableCell>
                                    <TableCell>{formatNumber(item.volume)}</TableCell>
                                    <TableCell>
                                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                                        {item.status || '-'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{item.fba || "-"}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingSku(item)
                                            setEditSkuDialogOpen(true)
                                          }}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={async () => {
                                            try {
                                              const response = await fetch(`/api/order-detail-items/${item.id}`, {
                                                method: 'DELETE',
                                              })
                                              if (!response.ok) {
                                                const errorData = await response.json()
                                                throw new Error(errorData.error || errorData.message || '删除失败')
                                              }
                                              toast.success('SKU明细已删除')
                                              onRefresh()
                                            } catch (error: any) {
                                              toast.error(error.message || '删除失败')
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-muted-foreground text-center py-4 text-sm">
                              暂无SKU明细，点击"添加SKU"按钮添加
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* 编辑仓点明细弹窗 */}
      <EditDetailDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        detail={editingDetail}
        onSave={handleSaveEdit}
      />

      {/* 添加仓点明细弹窗 */}
      <AddDetailDialog
        open={addDetailDialogOpen}
        onOpenChange={setAddDetailDialogOpen}
        onSave={handleAddDetail}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个仓点明细吗？此操作将同时删除该仓点的所有SKU明细，且无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑SKU明细弹窗 */}
      <EditSkuDialog
        open={editSkuDialogOpen}
        onOpenChange={setEditSkuDialogOpen}
        sku={editingSku}
        onSave={async (data) => {
          if (!editingSku) return
          try {
            const response = await fetch(`/api/order-detail-items/${editingSku.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || errorData.message || '保存失败')
            }
            toast.success('SKU明细已更新')
            setEditSkuDialogOpen(false)
            setEditingSku(null)
            onRefresh()
          } catch (error: any) {
            toast.error(error.message || '保存失败')
            throw error
          }
        }}
      />

      {/* 添加SKU明细弹窗 */}
      <AddSkuDialog
        open={addSkuDialogOpen}
        onOpenChange={setAddSkuDialogOpen}
        detailId={addSkuDetailId}
        onSave={async (data) => {
          if (!addSkuDetailId) return
          try {
            const response = await fetch('/api/order-detail-items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                detail_id: addSkuDetailId,
                ...data,
              }),
            })
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || errorData.message || '添加失败')
            }
            toast.success('SKU明细已添加')
            setAddSkuDialogOpen(false)
            setAddSkuDetailId(null)
            onRefresh()
          } catch (error: any) {
            toast.error(error.message || '添加失败')
            throw error
          }
        }}
      />
    </div>
  )
}

// 编辑仓点明细弹窗组件
function EditDetailDialog({
  open,
  onOpenChange,
  detail,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: OrderDetail | null
  onSave: (data: {
    quantity: number
    volume?: number | null
    container_volume?: number | null
    estimated_pallets?: number | null
  }) => Promise<void>
}) {
  const [quantity, setQuantity] = React.useState<string>('')
  const [volume, setVolume] = React.useState<string>('')
  const [containerVolume, setContainerVolume] = React.useState<string>('')
  const [estimatedPallets, setEstimatedPallets] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)

  // 当detail变化时，更新表单数据
  React.useEffect(() => {
    if (detail) {
      setQuantity(detail.quantity?.toString() || '')
      setVolume(detail.volume?.toString() || '')
      setContainerVolume(detail.container_volume?.toString() || '')
      setEstimatedPallets(detail.estimated_pallets?.toString() || '')
    }
  }, [detail])

  // 当对话框关闭时重置表单
  React.useEffect(() => {
    if (!open) {
      setQuantity('')
      setVolume('')
      setContainerVolume('')
      setEstimatedPallets('')
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('请输入有效的数量')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        quantity: parseInt(quantity),
        volume: volume ? parseFloat(volume) : null,
        container_volume: containerVolume ? parseFloat(containerVolume) : null,
        estimated_pallets: estimatedPallets ? parseInt(estimatedPallets) : null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  if (!detail) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑仓点明细</DialogTitle>
          <DialogDescription>
            修改仓点的详细信息。仓点ID: {detail.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">数量 *</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="请输入数量"
              min="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="volume">体积</Label>
            <Input
              id="volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="请输入体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="container_volume">货柜体积</Label>
            <Input
              id="container_volume"
              type="number"
              value={containerVolume}
              onChange={(e) => setContainerVolume(e.target.value)}
              placeholder="请输入货柜体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimated_pallets">预估托盘数</Label>
            <Input
              id="estimated_pallets"
              type="number"
              value={estimatedPallets}
              onChange={(e) => setEstimatedPallets(e.target.value)}
              placeholder="请输入预估托盘数"
              min="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 添加仓点明细弹窗组件
function AddDetailDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    quantity: number
    volume?: number | null
    container_volume?: number | null
    estimated_pallets?: number | null
  }) => Promise<void>
}) {
  const [quantity, setQuantity] = React.useState<string>('')
  const [volume, setVolume] = React.useState<string>('')
  const [containerVolume, setContainerVolume] = React.useState<string>('')
  const [estimatedPallets, setEstimatedPallets] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)

  // 当对话框关闭时重置表单
  React.useEffect(() => {
    if (!open) {
      setQuantity('')
      setVolume('')
      setContainerVolume('')
      setEstimatedPallets('')
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('请输入有效的数量')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        quantity: parseInt(quantity),
        volume: volume ? parseFloat(volume) : null,
        container_volume: containerVolume ? parseFloat(containerVolume) : null,
        estimated_pallets: estimatedPallets ? parseInt(estimatedPallets) : null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加仓点明细</DialogTitle>
          <DialogDescription>请输入仓点的详细信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="add-quantity">数量 *</Label>
            <Input
              id="add-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="请输入数量"
              min="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-volume">体积</Label>
            <Input
              id="add-volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="请输入体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-container_volume">货柜体积</Label>
            <Input
              id="add-container_volume"
              type="number"
              value={containerVolume}
              onChange={(e) => setContainerVolume(e.target.value)}
              placeholder="请输入货柜体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-estimated_pallets">预估托盘数</Label>
            <Input
              id="add-estimated_pallets"
              type="number"
              value={estimatedPallets}
              onChange={(e) => setEstimatedPallets(e.target.value)}
              placeholder="请输入预估托盘数"
              min="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 编辑SKU明细弹窗组件
function EditSkuDialog({
  open,
  onOpenChange,
  sku,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: OrderDetailItem | null
  onSave: (data: {
    detail_name: string
    sku: string
    description?: string | null
    stock_quantity?: number | null
    volume?: number | null
    status?: string | null
    fba?: string | null
  }) => Promise<void>
}) {
  const [detailName, setDetailName] = React.useState<string>('')
  const [skuCode, setSkuCode] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [stockQuantity, setStockQuantity] = React.useState<string>('')
  const [volume, setVolume] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('active')
  const [fba, setFba] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (sku) {
      setDetailName(sku.detail_name || '')
      setSkuCode(sku.sku || '')
      setDescription(sku.description || '')
      setStockQuantity(sku.stock_quantity?.toString() || '')
      setVolume(sku.volume?.toString() || '')
      setStatus(sku.status || 'active')
      setFba(sku.fba || '')
    }
  }, [sku])

  React.useEffect(() => {
    if (!open) {
      setDetailName('')
      setSkuCode('')
      setDescription('')
      setStockQuantity('')
      setVolume('')
      setStatus('active')
      setFba('')
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!detailName || !skuCode) {
      toast.error('请输入明细名称和SKU')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        detail_name: detailName,
        sku: skuCode,
        description: description || null,
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : null,
        volume: volume ? parseFloat(volume) : null,
        status: status || null,
        fba: fba || null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  if (!sku) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑SKU明细</DialogTitle>
          <DialogDescription>修改SKU的详细信息。SKU ID: {sku.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-detail-name">明细名称 *</Label>
            <Input
              id="edit-detail-name"
              value={detailName}
              onChange={(e) => setDetailName(e.target.value)}
              placeholder="请输入明细名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sku">SKU *</Label>
            <Input
              id="edit-sku"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              placeholder="请输入SKU"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">描述</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入描述"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-stock-quantity">库存数量</Label>
            <Input
              id="edit-stock-quantity"
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="请输入库存数量"
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-volume">体积</Label>
            <Input
              id="edit-volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="请输入体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-status">状态</Label>
            <Input
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="请输入状态"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-fba">FBA</Label>
            <Input
              id="edit-fba"
              value={fba}
              onChange={(e) => setFba(e.target.value)}
              placeholder="请输入FBA"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 添加SKU明细弹窗组件
function AddSkuDialog({
  open,
  onOpenChange,
  detailId,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailId: string | null
  onSave: (data: {
    detail_name: string
    sku: string
    description?: string | null
    stock_quantity?: number | null
    volume?: number | null
    status?: string | null
    fba?: string | null
  }) => Promise<void>
}) {
  const [detailName, setDetailName] = React.useState<string>('')
  const [skuCode, setSkuCode] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [stockQuantity, setStockQuantity] = React.useState<string>('')
  const [volume, setVolume] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('active')
  const [fba, setFba] = React.useState<string>('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setDetailName('')
      setSkuCode('')
      setDescription('')
      setStockQuantity('')
      setVolume('')
      setStatus('active')
      setFba('')
      setIsSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!detailName || !skuCode) {
      toast.error('请输入明细名称和SKU')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        detail_name: detailName,
        sku: skuCode,
        description: description || null,
        stock_quantity: stockQuantity ? parseInt(stockQuantity) : null,
        volume: volume ? parseFloat(volume) : null,
        status: status || null,
        fba: fba || null,
      })
    } catch (error) {
      // 错误已在onSave中处理
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加SKU明细</DialogTitle>
          <DialogDescription>请输入SKU的详细信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="add-detail-name">明细名称 *</Label>
            <Input
              id="add-detail-name"
              value={detailName}
              onChange={(e) => setDetailName(e.target.value)}
              placeholder="请输入明细名称（唯一）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-sku">SKU *</Label>
            <Input
              id="add-sku"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
              placeholder="请输入SKU"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-description">描述</Label>
            <Input
              id="add-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入描述"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-stock-quantity">库存数量</Label>
            <Input
              id="add-stock-quantity"
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="请输入库存数量"
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-volume">体积</Label>
            <Input
              id="add-volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="请输入体积"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-status">状态</Label>
            <Input
              id="add-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="请输入状态"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-fba">FBA</Label>
            <Input
              id="add-fba"
              value={fba}
              onChange={(e) => setFba(e.target.value)}
              placeholder="请输入FBA"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
