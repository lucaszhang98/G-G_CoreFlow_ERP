"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FuzzySearchSelect } from "@/components/ui/fuzzy-search-select"
import { LocationSelect } from "@/components/ui/location-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, X, Check, Pencil } from "lucide-react"
import { toast } from "sonner"
import { formatDateDisplay } from "@/lib/utils"

interface OrderDetailRow {
  id: string // 临时ID，用于表格渲染
  delivery_nature: string | null // 性质
  delivery_location: string | null // 送仓地点（location_id）
  delivery_location_code: string | null // 送仓地点编码（用于显示）
  quantity: number // 数量
  volume: number | null // 体积
  fba: string | null // FBA
  notes: string | null // 备注
  po: string | null // PO
}

interface CreateOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrderDialogProps) {
  const [step, setStep] = React.useState<1 | 2>(1)
  
  // 第一步：订单基本信息
  const [orderData, setOrderData] = React.useState({
    customer_id: null as string | null,
    order_number: '',
    order_date: new Date().toISOString().split('T')[0], // 默认今天
    eta_date: null as string | null,
    container_type: '40DH',
    mbl_number: '',
    status: 'pending' as 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'archived',
    operation_mode: null as 'unload' | 'direct_delivery' | null,
    delivery_location_id: null as string | number | null,
  })
  
  // 第二步：仓点明细
  const [orderDetails, setOrderDetails] = React.useState<OrderDetailRow[]>([])
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
  const [editingData, setEditingData] = React.useState<Partial<OrderDetailRow> | null>(null)
  
  const [isSaving, setIsSaving] = React.useState(false)

  // 重置表单
  const handleReset = () => {
    setStep(1)
    setOrderData({
      customer_id: null,
      order_number: '',
      order_date: new Date().toISOString().split('T')[0],
      eta_date: null,
      container_type: '40DH',
      mbl_number: '',
      status: 'pending',
      operation_mode: null,
      delivery_location_id: null,
    })
    setOrderDetails([])
    setEditingRowId(null)
    setEditingData(null)
  }

  // 关闭对话框
  const handleClose = () => {
    if (!isSaving) {
      handleReset()
      onOpenChange(false)
    }
  }

  // 第一步验证
  const validateStep1 = () => {
    if (!orderData.customer_id) {
      toast.error('请选择客户')
      return false
    }
    if (!orderData.order_number.trim()) {
      toast.error('请输入柜号')
      return false
    }
    if (!orderData.order_date) {
      toast.error('请选择订单日期')
      return false
    }
    if (!orderData.delivery_location_id) {
      toast.error('请选择目的地')
      return false
    }
    return true
  }

  // 第二步：添加明细行
  const handleAddDetail = () => {
    const newRow: OrderDetailRow = {
      id: `temp-${Date.now()}-${Math.random()}`,
      delivery_nature: null,
      delivery_location: null,
      delivery_location_code: null,
      quantity: 0,
      volume: null,
      fba: null,
      notes: null,
      po: null,
    }
    setOrderDetails([...orderDetails, newRow])
    setEditingRowId(newRow.id)
    setEditingData({ ...newRow })
  }

  // 编辑明细行
  const handleEditDetail = (rowId: string) => {
    const row = orderDetails.find(r => r.id === rowId)
    if (row) {
      setEditingRowId(rowId)
      setEditingData({ ...row })
    }
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingRowId || !editingData) return
    
    // 验证必填字段
    if (!editingData.delivery_nature) {
      toast.error('请选择性质')
      return
    }
    if (!editingData.delivery_location) {
      toast.error('请选择送仓地点')
      return
    }
    if (!editingData.quantity || editingData.quantity <= 0) {
      toast.error('请输入有效的数量')
      return
    }
    if (!editingData.volume || editingData.volume <= 0) {
      toast.error('请输入有效的体积')
      return
    }

    setOrderDetails(orderDetails.map(row => {
      if (row.id === editingRowId) {
        // 确保 delivery_location_code 被正确保存
        const updated = { ...row, ...editingData } as OrderDetailRow
        // 如果 editingData 中有 delivery_location_code，使用它；否则保留之前的
        if (editingData.delivery_location_code !== undefined) {
          updated.delivery_location_code = editingData.delivery_location_code
        } else if (!updated.delivery_location_code && row.delivery_location_code) {
          updated.delivery_location_code = row.delivery_location_code
        }
        return updated
      }
      return row
    }))
    setEditingRowId(null)
    setEditingData(null)
    toast.success('明细已保存')
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingRowId(null)
    setEditingData(null)
  }

  // 删除明细行
  const handleDeleteDetail = (rowId: string) => {
    setOrderDetails(orderDetails.filter(row => row.id !== rowId))
    if (editingRowId === rowId) {
      setEditingRowId(null)
      setEditingData(null)
    }
  }

  // 提交订单
  const handleSubmit = async () => {
    if (orderDetails.length === 0) {
      toast.error('请至少添加一条仓点明细')
      return
    }

    setIsSaving(true)
    try {
      // 先创建订单
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: orderData.customer_id ? Number(orderData.customer_id) : null,
          order_number: orderData.order_number,
          order_date: orderData.order_date,
          eta_date: orderData.eta_date || null,
          container_type: orderData.container_type || null,
          mbl_number: orderData.mbl_number || null,
          status: orderData.status || 'pending',
          operation_mode: orderData.operation_mode || null,
          delivery_location_id: orderData.delivery_location_id ? Number(orderData.delivery_location_id) : null,
          total_amount: 0, // 默认值
          discount_amount: 0,
          tax_amount: 0,
          final_amount: 0,
        }),
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json()
        throw new Error(errorData.error || '创建订单失败')
      }

      const orderResult = await orderResponse.json()
      const orderId = orderResult.data?.order_id || orderResult.data?.id

      if (!orderId) {
        throw new Error('订单创建成功但未返回订单ID')
      }

      // 然后创建所有明细
      const detailPromises = orderDetails.map(async (detail, index) => {
        try {
          const response = await fetch('/api/order-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderId.toString(),
              quantity: detail.quantity || 0,
              volume: detail.volume || null,
              delivery_nature: detail.delivery_nature || null,
              delivery_location: detail.delivery_location || null, // location_id（字符串或数字）
              fba: detail.fba || null,
              notes: detail.notes || null,
              po: detail.po || null,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || `明细 ${index + 1} 创建失败`)
          }

          return { success: true, index }
        } catch (error: any) {
          console.error(`明细 ${index + 1} 创建失败:`, error)
          return { success: false, index, error: error.message || '创建失败' }
        }
      })

      const detailResults = await Promise.all(detailPromises)
      const failedDetails = detailResults.filter(res => !res.success)
      const successDetails = detailResults.filter(res => res.success)
      
      if (failedDetails.length > 0) {
        const errorMessages = failedDetails.map(f => `明细 ${f.index + 1}: ${f.error}`).join('; ')
        console.error('部分明细创建失败:', failedDetails)
        
        // 如果有部分明细创建成功，提示用户
        if (successDetails.length > 0) {
          toast.error(`订单已创建，但 ${failedDetails.length} 条明细创建失败: ${errorMessages}`)
          onSuccess() // 刷新列表显示已创建的明细
        } else {
          // 所有明细都创建失败，不关闭对话框，让用户重试
          toast.error(`所有明细创建失败: ${errorMessages}`)
          setIsSaving(false)
          return // 不关闭对话框，不重置表单
        }
      } else {
        toast.success('订单创建成功')
      }

      // 只有成功或部分成功时才关闭对话框
      if (failedDetails.length === 0) {
        // 全部成功
        handleReset()
        onOpenChange(false)
        onSuccess()
      } else if (successDetails.length > 0) {
        // 部分成功，关闭对话框并刷新
        handleReset()
        onOpenChange(false)
      }
      // 如果全部失败，不关闭对话框（已在上面处理）
    } catch (error: any) {
      console.error('创建订单失败:', error)
      toast.error(error.message || '创建订单失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? '第一步：订单基本信息' : '第二步：仓点明细'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? '填写订单的基本信息'
              : '添加订单的仓点明细，至少需要一条明细'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">客户代码 *</Label>
                <FuzzySearchSelect
                  value={orderData.customer_id}
                  onChange={(value) => setOrderData({ ...orderData, customer_id: value ? String(value) : null })}
                  loadOptions={async (search: string) => {
                    try {
                      // 调用API进行后端模糊搜索
                      const params = new URLSearchParams()
                      // 始终传递搜索参数（即使是空字符串），这样API会返回所有数据
                      if (search && search.trim()) {
                        params.set('search', search.trim())
                        // 有搜索条件时，使用无限制搜索，返回所有匹配结果
                        params.set('unlimited', 'true')
                      } else {
                        // 没有搜索条件时，也返回数据（用于初始加载）
                        params.set('limit', '1000')
                      }
                      
                      const url = `/api/customers?${params.toString()}`
                      const response = await fetch(url)
                      if (!response.ok) {
                        return []
                      }
                      
                      const data = await response.json()
                      
                      // API返回格式: { data: [...], pagination: {...} }
                      if (data && Array.isArray(data.data)) {
                        return data.data.map((customer: any) => ({
                          label: customer.code || customer.name || customer.company_name || '',
                          value: customer.id?.toString() || '',
                        }))
                      }
                      
                      return []
                    } catch (err) {
                      // 静默处理错误
                      return []
                    }
                  }}
                  placeholder="搜索并选择客户代码"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order_number">柜号 *</Label>
                <Input
                  id="order_number"
                  value={orderData.order_number}
                  onChange={(e) => setOrderData({ ...orderData, order_number: e.target.value })}
                  placeholder="请输入柜号"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order_date">订单日期 *</Label>
                <Input
                  id="order_date"
                  type="date"
                  value={orderData.order_date}
                  onChange={(e) => setOrderData({ ...orderData, order_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eta_date">ETA</Label>
                <Input
                  id="eta_date"
                  type="date"
                  value={orderData.eta_date || ''}
                  onChange={(e) => setOrderData({ ...orderData, eta_date: e.target.value || null })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="container_type">柜型</Label>
                <Select
                  value={orderData.container_type}
                  onValueChange={(value) => setOrderData({ ...orderData, container_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择柜型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="40DH">40DH</SelectItem>
                    <SelectItem value="45DH">45DH</SelectItem>
                    <SelectItem value="40RH">40RH</SelectItem>
                    <SelectItem value="45RH">45RH</SelectItem>
                    <SelectItem value="20GP">20GP</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mbl_number">MBL</Label>
                <Input
                  id="mbl_number"
                  value={orderData.mbl_number}
                  onChange={(e) => setOrderData({ ...orderData, mbl_number: e.target.value })}
                  placeholder="请输入MBL号码"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_location_id">目的地 *</Label>
                <LocationSelect
                  value={orderData.delivery_location_id}
                  onChange={(value: string | number | null) => {
                    setOrderData({ ...orderData, delivery_location_id: value })
                  }}
                  placeholder="请选择目的地"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select
                  value={orderData.status}
                  onValueChange={(value: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'archived') => 
                    setOrderData({ ...orderData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待处理</SelectItem>
                    <SelectItem value="confirmed">已确认</SelectItem>
                    <SelectItem value="shipped">已发货</SelectItem>
                    <SelectItem value="delivered">已交付</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                    <SelectItem value="archived">完成留档</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operation_mode">操作方式</Label>
                <Select
                  value={orderData.operation_mode || undefined}
                  onValueChange={(value: 'unload' | 'direct_delivery') => 
                    setOrderData({ ...orderData, operation_mode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择操作方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unload">拆柜</SelectItem>
                    <SelectItem value="direct_delivery">直送</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <Label>仓点明细</Label>
              <Button
                type="button"
                size="sm"
                onClick={handleAddDetail}
                disabled={isSaving}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加明细
              </Button>
            </div>

            {orderDetails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                请添加仓点明细
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>性质</TableHead>
                      <TableHead>送仓地点</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>体积</TableHead>
                      <TableHead>FBA</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.map((row) => {
                      const isEditing = editingRowId === row.id
                      return (
                        <TableRow key={row.id}>
                          {isEditing ? (
                            <>
                              <TableCell>
                                <Select
                                  value={editingData?.delivery_nature || ''}
                                  onValueChange={(value) => setEditingData({ ...editingData, delivery_nature: value || null })}
                                >
                                  <SelectTrigger className="w-full min-w-[120px]">
                                    <SelectValue placeholder="请选择" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AMZ">AMZ</SelectItem>
                                    <SelectItem value="扣货">扣货</SelectItem>
                                    <SelectItem value="已放行">已放行</SelectItem>
                                    <SelectItem value="私仓">私仓</SelectItem>
                                    <SelectItem value="转仓">转仓</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <LocationSelect
                                  value={editingData?.delivery_location || null}
                                  onChange={async (value: string | number | null) => {
                                    // 保存 location_id
                                    const locationId = value ? String(value) : null
                                    
                                    // 如果有 location_id，查询对应的 location_code
                                    let locationCode: string | null = null
                                    if (locationId) {
                                      try {
                                        const response = await fetch(`/api/locations/${locationId}`)
                                        if (response.ok) {
                                          const data = await response.json()
                                          // API 返回格式可能是 { data: { location_code: ... } } 或直接是 { location_code: ... }
                                          locationCode = data.data?.location_code || data.location_code || null
                                        }
                                      } catch (err) {
                                        // 静默处理错误，不影响用户体验
                                      }
                                    }
                                    
                                    // 更新编辑数据，确保 location_code 被保存
                                    setEditingData({ 
                                      ...editingData, 
                                      delivery_location: locationId,
                                      delivery_location_code: locationCode,
                                    })
                                  }}
                                  placeholder="选择送仓地点"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={editingData?.quantity || ''}
                                  onChange={(e) => setEditingData({ ...editingData, quantity: parseInt(e.target.value) || 0 })}
                                  className="w-20"
                                  min="1"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingData?.volume || ''}
                                  onChange={(e) => setEditingData({ ...editingData, volume: parseFloat(e.target.value) || null })}
                                  className="w-24"
                                  min="0"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={editingData?.fba || ''}
                                  onChange={(e) => setEditingData({ ...editingData, fba: e.target.value || null })}
                                  className="min-w-[200px]"
                                  placeholder="FBA"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={editingData?.notes || ''}
                                  onChange={(e) => setEditingData({ ...editingData, notes: e.target.value || null })}
                                  className="w-32"
                                  placeholder="备注"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={editingData?.po || ''}
                                  onChange={(e) => setEditingData({ ...editingData, po: e.target.value || null })}
                                  className="min-w-[200px]"
                                  placeholder="PO"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSaveEdit}
                                    className="h-7 w-7 p-0"
                                    title="保存"
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    className="h-7 w-7 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{row.delivery_nature || '-'}</TableCell>
                              <TableCell>{row.delivery_location_code || row.delivery_location || '-'}</TableCell>
                              <TableCell>{row.quantity}</TableCell>
                              <TableCell>{row.volume || '-'}</TableCell>
                              <TableCell>{row.fba || '-'}</TableCell>
                              <TableCell>{row.notes || '-'}</TableCell>
                              <TableCell>{row.po || '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditDetail(row.id)}
                                    className="h-7 w-7 p-0"
                                    disabled={isSaving}
                                    title="编辑"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteDetail(row.id)}
                                    className="h-7 w-7 p-0"
                                    disabled={isSaving}
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
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) {
                handleClose()
              } else {
                setStep(1)
              }
            }}
            disabled={isSaving}
          >
            {step === 1 ? '取消' : '上一步'}
          </Button>
          {step === 1 ? (
            <Button
              onClick={() => {
                if (validateStep1()) {
                  setStep(2)
                }
              }}
              disabled={isSaving}
            >
              下一步
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSaving || orderDetails.length === 0}
            >
              {isSaving ? '保存中...' : '提交'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

