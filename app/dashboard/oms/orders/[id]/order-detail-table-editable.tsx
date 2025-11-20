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
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface OrderDetailItem {
  id: bigint | string
  detail_name: string
  sku: string
  description: string | null
  stock_quantity: number | null
  volume: number | string | null
  status: string | null
  fba: string | null
  detail_id: bigint | string | null
  created_at: string | Date | null
  updated_at: string | Date | null
  created_by: bigint | string | number | null
  updated_by: bigint | string | number | null
}

interface OrderDetail {
  id: bigint | string
  order_id: bigint | string | null
  detail_id: bigint | string | null
  quantity: number
  volume: number | string | null
  container_volume: number | string | null
  estimated_pallets: number | null
  created_at: string | Date | null
  updated_at: string | Date | null
  created_by: bigint | string | number | null
  updated_by: bigint | string | number | null
  order_detail_item_order_detail_item_detail_idToorder_detail: OrderDetailItem[]
}

interface OrderDetailTableEditableProps {
  orderId: string
  orderDetails: OrderDetail[]
}

export function OrderDetailTableEditable({ orderId, orderDetails: initialOrderDetails }: OrderDetailTableEditableProps) {
  const router = useRouter()
  const [orderDetails, setOrderDetails] = React.useState<OrderDetail[]>(initialOrderDetails)
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editingDetailId, setEditingDetailId] = React.useState<string | null>(null)
  const [editingItemId, setEditingItemId] = React.useState<{ detailId: string; itemId: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<{ type: 'detail' | 'item'; detailId: string; itemId?: string } | null>(null)
  const [addDetailDialogOpen, setAddDetailDialogOpen] = React.useState(false)
  const [addItemDialogOpen, setAddItemDialogOpen] = React.useState(false)
  const [selectedDetailIdForItem, setSelectedDetailIdForItem] = React.useState<string | null>(null)

  const refreshData = () => {
    router.refresh()
  }

  // 同步外部数据
  React.useEffect(() => {
    setOrderDetails(initialOrderDetails)
  }, [initialOrderDetails])

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const formatNumber = (value: number | null | string) => {
    if (!value && value !== 0) return "-"
    const numValue = typeof value === 'string' 
      ? parseFloat(value) 
      : Number(value)
    if (isNaN(numValue)) return "-"
    return numValue.toLocaleString()
  }

  // 编辑仓点明细
  const handleEditDetail = (detailId: string) => {
    setEditingDetailId(detailId)
  }

  const handleSaveDetail = async (detail: OrderDetail) => {
    try {
      const response = await fetch(`/api/order-details/${detail.id.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          quantity: detail.quantity,
          volume: detail.volume,
          container_volume: detail.container_volume,
          estimated_pallets: detail.estimated_pallets,
        }),
      })

      if (!response.ok) {
        throw new Error('更新失败')
      }

      toast.success('仓点明细更新成功')
      setEditingDetailId(null)
      refreshData()
    } catch (error) {
      toast.error('更新失败')
    }
  }

  // 删除仓点明细
  const handleDeleteDetail = async (detailId: string) => {
    try {
      const response = await fetch(`/api/order-details/${detailId.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      toast.success('仓点明细删除成功')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      refreshData()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  // 添加仓点明细
  const handleAddDetail = async (formData: any) => {
    try {
      const response = await fetch('/api/order-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          ...formData,
        }),
      })

      if (!response.ok) {
        throw new Error('创建失败')
      }

      toast.success('仓点明细创建成功')
      setAddDetailDialogOpen(false)
      refreshData()
    } catch (error) {
      toast.error('创建失败')
    }
  }

  // 编辑SKU明细
  const handleEditItem = (detailId: string, itemId: string) => {
    setEditingItemId({ detailId, itemId })
  }

  const handleSaveItem = async (item: OrderDetailItem) => {
    try {
      const response = await fetch(`/api/order-detail-items/${item.id.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detail_id: item.detail_id,
          detail_name: item.detail_name,
          sku: item.sku,
          description: item.description,
          stock_quantity: item.stock_quantity,
          volume: item.volume,
          status: item.status,
          fba: item.fba,
        }),
      })

      if (!response.ok) {
        throw new Error('更新失败')
      }

      toast.success('SKU明细更新成功')
      setEditingItemId(null)
      refreshData()
    } catch (error) {
      toast.error('更新失败')
    }
  }

  // 删除SKU明细
  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/order-detail-items/${itemId.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      toast.success('SKU明细删除成功')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      refreshData()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  // 添加SKU明细
  const handleAddItem = async (detailId: string, formData: any) => {
    try {
      const response = await fetch('/api/order-detail-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detail_id: detailId,
          ...formData,
        }),
      })

      if (!response.ok) {
        throw new Error('创建失败')
      }

      toast.success('SKU明细创建成功')
      setAddItemDialogOpen(false)
      setSelectedDetailIdForItem(null)
      refreshData()
    } catch (error) {
      toast.error('创建失败')
    }
  }

  if (!orderDetails || orderDetails.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setAddDetailDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加仓点明细
          </Button>
        </div>
        <p className="text-muted-foreground text-center py-8">暂无仓点明细</p>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>仓点ID</TableHead>
            <TableHead>订单ID</TableHead>
            <TableHead>明细ID</TableHead>
            <TableHead>数量</TableHead>
            <TableHead>体积</TableHead>
            <TableHead>货柜体积</TableHead>
            <TableHead>预估托盘数</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead>创建人ID</TableHead>
            <TableHead>更新人ID</TableHead>
            <TableHead>关联产品</TableHead>
            <TableHead className="w-32">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderDetails.map((detail) => {
            const rowId = detail.id.toString()
            const isExpanded = expandedRows.has(rowId)
            const isEditing = editingDetailId === rowId
            
            const relatedItems = detail.order_detail_item_order_detail_item_detail_idToorder_detail || []
            const itemsToShow = relatedItems

            return (
              <React.Fragment key={rowId}>
                {/* 主行：仓点明细 */}
                <TableRow>
                  <TableCell>
                    {itemsToShow.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleRow(rowId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <div className="w-6" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{detail.id.toString()}</TableCell>
                  <TableCell>{detail.order_id ? detail.order_id.toString() : "-"}</TableCell>
                  <TableCell>{detail.detail_id ? detail.detail_id.toString() : "-"}</TableCell>
                  {isEditing ? (
                    <>
                      <TableCell>
                        <Input
                          type="number"
                          value={detail.quantity}
                          onChange={(e) => {
                            const updated = orderDetails.map(d => 
                              d.id.toString() === rowId 
                                ? { ...d, quantity: parseInt(e.target.value) || 0 }
                                : d
                            )
                            setOrderDetails(updated)
                          }}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={detail.volume || ''}
                          onChange={(e) => {
                            const updated = orderDetails.map(d => 
                              d.id.toString() === rowId 
                                ? { ...d, volume: e.target.value }
                                : d
                            )
                            setOrderDetails(updated)
                          }}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={detail.container_volume || ''}
                          onChange={(e) => {
                            const updated = orderDetails.map(d => 
                              d.id.toString() === rowId 
                                ? { ...d, container_volume: e.target.value }
                                : d
                            )
                            setOrderDetails(updated)
                          }}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={detail.estimated_pallets || ''}
                          onChange={(e) => {
                            const updated = orderDetails.map(d => 
                              d.id.toString() === rowId 
                                ? { ...d, estimated_pallets: parseInt(e.target.value) || null }
                                : d
                            )
                            setOrderDetails(updated)
                          }}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell colSpan={4}>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const detailToSave = orderDetails.find(d => d.id.toString() === rowId)
                              if (detailToSave) {
                                handleSaveDetail(detailToSave)
                              }
                            }}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingDetailId(null)
                              setOrderDetails(initialOrderDetails)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{detail.quantity}</TableCell>
                      <TableCell>{formatNumber(detail.volume)}</TableCell>
                      <TableCell>{formatNumber(detail.container_volume)}</TableCell>
                      <TableCell>{detail.estimated_pallets || "-"}</TableCell>
                      <TableCell>{detail.created_at ? new Date(detail.created_at).toLocaleDateString('zh-CN') : "-"}</TableCell>
                      <TableCell>{detail.updated_at ? new Date(detail.updated_at).toLocaleDateString('zh-CN') : "-"}</TableCell>
                      <TableCell>{detail.created_by ? detail.created_by.toString() : "-"}</TableCell>
                      <TableCell>{detail.updated_by ? detail.updated_by.toString() : "-"}</TableCell>
                      <TableCell>
                        {itemsToShow.length > 0 ? (
                          <Badge variant="outline">{itemsToShow.length} 个SKU</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditDetail(rowId)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setItemToDelete({ type: 'detail', detailId: rowId })
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDetailIdForItem(rowId)
                              setAddItemDialogOpen(true)
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>

                {/* 展开的子行：SKU明细 */}
                {isExpanded && itemsToShow.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="p-0">
                      <div className="bg-muted/30 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-medium text-muted-foreground">
                            SKU明细 ({itemsToShow.length} 项)
                          </div>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-muted">
                              <TableHead>SKU ID</TableHead>
                              <TableHead>SKU代码</TableHead>
                              <TableHead>SKU名称</TableHead>
                              <TableHead>描述</TableHead>
                              <TableHead>库存数量</TableHead>
                              <TableHead>体积</TableHead>
                              <TableHead>状态</TableHead>
                              <TableHead>FBA</TableHead>
                              <TableHead>明细ID</TableHead>
                              <TableHead>创建时间</TableHead>
                              <TableHead>更新时间</TableHead>
                              <TableHead>创建人ID</TableHead>
                              <TableHead>更新人ID</TableHead>
                              <TableHead className="w-32">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itemsToShow.map((item) => {
                              const itemId = item.id.toString()
                              const isEditingItem = editingItemId?.detailId === rowId && editingItemId?.itemId === itemId
                              
                              return (
                                <TableRow key={itemId} className="border-muted">
                                  {isEditingItem ? (
                                    <>
                                      <TableCell className="font-medium">{itemId}</TableCell>
                                      <TableCell>
                                        <Input
                                          value={item.detail_name}
                                          onChange={(e) => {
                                            const updated = orderDetails.map(d => {
                                              if (d.id.toString() === rowId) {
                                                return {
                                                  ...d,
                                                  order_detail_item_order_detail_item_detail_idToorder_detail: d.order_detail_item_order_detail_item_detail_idToorder_detail.map(i =>
                                                    i.id.toString() === itemId
                                                      ? { ...i, detail_name: e.target.value }
                                                      : i
                                                  )
                                                }
                                              }
                                              return d
                                            })
                                            setOrderDetails(updated)
                                          }}
                                          className="w-32"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          value={item.sku}
                                          onChange={(e) => {
                                            const updated = orderDetails.map(d => {
                                              if (d.id.toString() === rowId) {
                                                return {
                                                  ...d,
                                                  order_detail_item_order_detail_item_detail_idToorder_detail: d.order_detail_item_order_detail_item_detail_idToorder_detail.map(i =>
                                                    i.id.toString() === itemId
                                                      ? { ...i, sku: e.target.value }
                                                      : i
                                                  )
                                                }
                                              }
                                              return d
                                            })
                                            setOrderDetails(updated)
                                          }}
                                          className="w-40"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          value={item.description || ''}
                                          onChange={(e) => {
                                            const updated = orderDetails.map(d => {
                                              if (d.id.toString() === rowId) {
                                                return {
                                                  ...d,
                                                  order_detail_item_order_detail_item_detail_idToorder_detail: d.order_detail_item_order_detail_item_detail_idToorder_detail.map(i =>
                                                    i.id.toString() === itemId
                                                      ? { ...i, description: e.target.value }
                                                      : i
                                                  )
                                                }
                                              }
                                              return d
                                            })
                                            setOrderDetails(updated)
                                          }}
                                          className="w-48"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={item.stock_quantity || ''}
                                          onChange={(e) => {
                                            const updated = orderDetails.map(d => {
                                              if (d.id.toString() === rowId) {
                                                return {
                                                  ...d,
                                                  order_detail_item_order_detail_item_detail_idToorder_detail: d.order_detail_item_order_detail_item_detail_idToorder_detail.map(i =>
                                                    i.id.toString() === itemId
                                                      ? { ...i, stock_quantity: parseInt(e.target.value) || null }
                                                      : i
                                                  )
                                                }
                                              }
                                              return d
                                            })
                                            setOrderDetails(updated)
                                          }}
                                          className="w-24"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={item.volume || ''}
                                          onChange={(e) => {
                                            const updated = orderDetails.map(d => {
                                              if (d.id.toString() === rowId) {
                                                return {
                                                  ...d,
                                                  order_detail_item_order_detail_item_detail_idToorder_detail: d.order_detail_item_order_detail_item_detail_idToorder_detail.map(i =>
                                                    i.id.toString() === itemId
                                                      ? { ...i, volume: e.target.value }
                                                      : i
                                                  )
                                                }
                                              }
                                              return d
                                            })
                                            setOrderDetails(updated)
                                          }}
                                          className="w-24"
                                        />
                                      </TableCell>
                                      <TableCell colSpan={8}>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              const detail = orderDetails.find(d => d.id.toString() === rowId)
                                              const itemToSave = detail?.order_detail_item_order_detail_item_detail_idToorder_detail.find(i => i.id.toString() === itemId)
                                              if (itemToSave) {
                                                handleSaveItem(itemToSave)
                                              }
                                            }}
                                          >
                                            <Save className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setEditingItemId(null)
                                              setOrderDetails(initialOrderDetails)
                                            }}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="font-medium">{itemId}</TableCell>
                                      <TableCell className="font-medium">{item.detail_name}</TableCell>
                                      <TableCell>{item.sku}</TableCell>
                                      <TableCell>{item.description || "-"}</TableCell>
                                      <TableCell>{formatNumber(item.stock_quantity)}</TableCell>
                                      <TableCell>{formatNumber(item.volume)}</TableCell>
                                      <TableCell>
                                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                                          {item.status || "-"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{item.fba || "-"}</TableCell>
                                      <TableCell>{item.detail_id ? item.detail_id.toString() : "-"}</TableCell>
                                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : "-"}</TableCell>
                                      <TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleDateString('zh-CN') : "-"}</TableCell>
                                      <TableCell>{item.created_by ? item.created_by.toString() : "-"}</TableCell>
                                      <TableCell>{item.updated_by ? item.updated_by.toString() : "-"}</TableCell>
                                      <TableCell>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEditItem(rowId, itemId)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setItemToDelete({ type: 'item', detailId: rowId, itemId })
                                              setDeleteDialogOpen(true)
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </>
                                  )}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个{itemToDelete?.type === 'detail' ? '仓点明细' : 'SKU明细'}吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (itemToDelete?.type === 'detail') {
                  handleDeleteDetail(itemToDelete.detailId)
                } else if (itemToDelete?.itemId) {
                  handleDeleteItem(itemToDelete.itemId)
                }
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加仓点明细对话框 */}
      <AddDetailDialog
        open={addDetailDialogOpen}
        onOpenChange={setAddDetailDialogOpen}
        onSave={handleAddDetail}
      />

      {/* 添加SKU明细对话框 */}
      <AddItemDialog
        open={addItemDialogOpen}
        onOpenChange={setAddItemDialogOpen}
        onSave={(formData) => {
          if (selectedDetailIdForItem) {
            handleAddItem(selectedDetailIdForItem, formData)
          }
        }}
      />
    </div>
  )
}

// 添加仓点明细对话框组件
function AddDetailDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (data: any) => void }) {
  const [formData, setFormData] = React.useState({
    quantity: 0,
    volume: '',
    container_volume: '',
    estimated_pallets: null as number | null,
  })

  const handleSubmit = () => {
    onSave(formData)
    setFormData({ quantity: 0, volume: '', container_volume: '', estimated_pallets: null })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加仓点明细</DialogTitle>
          <DialogDescription>填写仓点明细信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">数量</label>
            <Input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">体积</label>
            <Input
              type="number"
              value={formData.volume}
              onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">货柜体积</label>
            <Input
              type="number"
              value={formData.container_volume}
              onChange={(e) => setFormData({ ...formData, container_volume: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">预估托盘数</label>
            <Input
              type="number"
              value={formData.estimated_pallets || ''}
              onChange={(e) => setFormData({ ...formData, estimated_pallets: parseInt(e.target.value) || null })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 添加SKU明细对话框组件
function AddItemDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (data: any) => void }) {
  const [formData, setFormData] = React.useState({
    detail_name: '',
    sku: '',
    description: '',
    stock_quantity: null as number | null,
    volume: '',
    status: 'active',
    fba: '',
  })

  const handleSubmit = () => {
    onSave(formData)
    setFormData({ detail_name: '', sku: '', description: '', stock_quantity: null, volume: '', status: 'active', fba: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加SKU明细</DialogTitle>
          <DialogDescription>填写SKU明细信息</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">SKU代码</label>
            <Input
              value={formData.detail_name}
              onChange={(e) => setFormData({ ...formData, detail_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">SKU名称</label>
            <Input
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">描述</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">库存数量</label>
            <Input
              type="number"
              value={formData.stock_quantity || ''}
              onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || null })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">体积</label>
            <Input
              type="number"
              value={formData.volume}
              onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">状态</label>
            <Input
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">FBA</label>
            <Input
              value={formData.fba}
              onChange={(e) => setFormData({ ...formData, fba: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

