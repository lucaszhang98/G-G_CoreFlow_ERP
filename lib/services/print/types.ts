/**
 * 打印服务类型定义
 * 
 * 每个单据类型有独立的数据接口，不强制统一
 */

/**
 * 拆柜单据数据（A4）
 * 对应：入库管理 (inbound_receipt)
 */
export interface UnloadSheetData {
  // 主数据
  containerNumber: string // 柜号
  unloadedBy?: string // 拆柜人员
  receivedBy?: string // 入库人员
  unloadDate?: Date | string // 拆柜日期
  
  // 明细行
  orderDetails: Array<{
    // 从详情页获取的数据
    deliveryNature?: string // 性质
    deliveryLocation?: string // 仓点
    quantity?: number // 数量
    notes?: string // 备注（从详情页）
    
    // 留白等工人填写
    actualPallets?: number // 实际板数（留白）
    storageLocation?: string // 库位（留白）
    workerNotes?: string // 备注（留白）
  }>
}

/**
 * 装车单数据（竖排 A4）
 */
export interface LoadSheetData {
  // 出库单信息
  shipmentNumber: string
  scheduledLoadTime?: Date | string
  actualLoadTime?: Date | string
  
  // 仓库信息
  warehouse: {
    code?: string
    name: string
    address?: string
  }
  
  // 目的地
  destination: {
    code?: string
    name: string
    address?: string
  }
  
  // 车辆信息
  vehicle?: {
    plateNumber?: string
    type?: string
  }
  
  // 装车人员
  loadedBy?: {
    id: string
    name: string
  }
  
  // 明细
  shipmentLines: Array<{
    lineNumber?: number
    orderNumber?: string
    deliveryLocation?: string
    palletCount?: number
    volume?: number
    weight?: number
    notes?: string
  }>
  
  // 统计信息
  totalPallets?: number
  totalVolume?: number
  totalWeight?: number
}

/**
 * BOL (Bill of Lading) 数据（竖排 A4）
 */
export interface BOLData {
  // 出库单信息
  shipmentNumber: string
  shipmentDate: Date | string
  
  // 承运商信息
  carrier: {
    code?: string
    name: string
    address?: string
    phone?: string
  }
  
  // 发货方（仓库）
  shipper: {
    code?: string
    name: string
    address?: string
  }
  
  // 收货方（目的地）
  consignee: {
    name: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  
  // 车辆和司机
  vehicle?: {
    plateNumber?: string
    type?: string
  }
  driver?: {
    name: string
    licenseNumber?: string
    phone?: string
  }
  
  // 明细
  shipmentLines: Array<{
    lineNumber?: number
    description?: string
    quantity?: number
    palletCount?: number
    volume?: number
    weight?: number
    notes?: string
  }>
  
  // 统计信息
  totalPallets?: number
  totalVolume?: number
  totalWeight?: number
  
  // 特殊字段
  specialInstructions?: string
  referenceNumbers?: string[]
}

/**
 * Label 数据（4×6 英寸，竖排）
 * 
 * 布局说明：
 * - 第一行：柜号 (containerNumber)
 * - 第二行：仓点 (deliveryLocation)
 * - 第三行：柜号和仓点的条形码（合并显示）
 * - 第四行：左侧客户代码，右侧预计拆柜日期
 * 
 * 生成规则：
 * - 根据订单明细行生成
 * - 每个明细生成数量 = 预计板数 (estimatedPallets) * 4
 */
export interface LabelData {
  // 柜号（第一行）
  containerNumber: string
  
  // 仓点（第二行）
  deliveryLocation: string
  deliveryLocationCode?: string
  
  // 性质（用于在仓点后添加标识）
  deliveryNature?: string // 转仓、扣货等
  
  // 条形码内容（第三行）：柜号+仓点的组合
  barcode: string // 格式：{containerNumber}-{deliveryLocationCode}
  
  // 客户代码（第四行左侧）
  customerCode: string
  
  // 预计拆柜日期（第四行右侧）
  plannedUnloadDate: string // YYYY-MM-DD 格式
  
  // 订单明细信息（用于生成）
  orderDetailId: string
  estimatedPallets: number // 预计板数，用于计算生成数量
}



