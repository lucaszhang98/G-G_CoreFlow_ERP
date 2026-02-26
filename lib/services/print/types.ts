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
  orderNotes?: string // 订单备注（显示在单据最上方）
  containerNumber: string // 柜号
  customerCode?: string // 客户代码
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
 * OAK 装车单模板数据（与 Excel「装车单模板」一致）
 * 布局：卸货仓+仓点 | Trailer | Load# | SEAL# | 预约时间 | 表头 柜号|仓储位置|备注|计划板数|装车板数|剩余板数|是否清空 | 合计
 */
export interface OAKLoadSheetData {
  /** 卸货仓标签（固定「卸货仓」） */
  destinationLabel: string
  /** 仓点代码，如 TCY2 */
  destinationCode: string
  /** Trailer 车架号 */
  trailer: string
  /** Load# 装车单号，如预约号码或 ID */
  loadNumber: string
  /** SEAL# 封条号（可选） */
  sealNumber: string
  /** 预约时间 */
  appointmentTime: string
  /** 详细地址（装车单第3行第2列） */
  delivery_address?: string | null
  /** 联系人（可选，装车单可扩展用） */
  contact_name?: string | null
  /** 电话（可选） */
  contact_phone?: string | null
  /** 明细行（装车板数、剩余板数、是否清空留空供手填；备注=装车单明细备注） */
  lines: Array<{
    container_number: string
    storage_location: string
    /** 装车单明细备注（第3列，仓储位置与计划板数之间） */
    load_sheet_notes?: string | null
    planned_pallets: number
    loaded_pallets: string
    remaining_pallets: string
    is_clear: boolean | string
  }>
  /** 计划板数合计 */
  totalPlannedPallets: number
  /** 合计行「是否清空」显示：类型（地板/卡板），无则留空供手填 */
  totalIsClearLabel?: string
  /** 派送方式（卡派/自提等），与类型同格显示，空格后追加 */
  deliveryMethod?: string | null
  /** 可选：由 API 解析好的 logo data URL，本地/正式环境通用 */
  logoDataUrl?: string | null
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
 * OAK BOL 模板数据（与 docs/135928027988 SCK8 BOL.pdf 样本一致）
 * 用于出库管理生成 BOL PDF
 */
export interface OAKBOLData {
  /** 打印时间，如 2026-02-04 16:06:37（不生成二维码） */
  printTime: string
  /** 发货方 Ship from */
  shipFrom: {
    companyName: string
    address: string
    attn: string
    phone: string
  }
  /** 收货方 Ship to */
  shipTo: {
    destinationCode: string
    address: string
    attn: string
    phone: string
  }
  /** 预约号 Appointment ID */
  appointmentId: string
  /** 预约时间 Appointment time */
  appointmentTime: string
  /** SEAL（留空） */
  seal: string
  /** Container（留空） */
  container: string
  /** 明细行：Container | 备注(bol_notes) | FBA | Qty (PLTS) | Box | Storage | PO */
  lines: Array<{
    container_number: string
    /** BOL 明细备注（第2列，Container 与 FBA 之间） */
    bol_notes?: string | null
    fba_id: string
    qty_plts: number | string
    box: number | string
    storage: string
    po_id: string
  }>
  /** 可选：由 API 解析好的 logo data URL */
  logoDataUrl?: string | null
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
  deliveryNature?: string // 转仓、扣货、私仓等
  
  // 备注（用于私仓时显示）
  notes?: string
  
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

