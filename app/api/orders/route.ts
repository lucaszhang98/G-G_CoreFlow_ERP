import { NextRequest, NextResponse } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { orderConfig } from '@/lib/crud/configs/orders'
import { inboundSyncService } from '@/lib/services/inbound-sync.service'
import { auth } from '@/auth'

// GET - 获取订单列表
export const GET = createListHandler(orderConfig)

// POST - 创建订单（自定义逻辑：自动创建入库管理记录）
export async function POST(request: NextRequest) {
  // 1. 使用通用 Handler 创建订单
  const response = await createCreateHandler(orderConfig)(request)
  
  // 2. 如果创建成功且 operation_mode = 'unload'（拆柜），自动创建 inbound_receipt
  if (response.status === 200 || response.status === 201) {
    try {
      const responseData = await response.json()
      const orderId = responseData.data?.order_id
      const operationMode = responseData.data?.operation_mode
      
      if (orderId && operationMode === 'unload') {
        const session = await auth()
        const userId = session?.user?.id ? BigInt(session.user.id) : undefined
        
        // 异步同步入库管理记录（不阻塞响应）
        inboundSyncService.syncInboundReceiptForOrder(BigInt(orderId), userId).catch(error => {
          console.error('[Orders POST] 自动创建入库管理记录失败:', error)
        })
      }
      
      // 返回原始响应
      return NextResponse.json(responseData, { status: response.status })
    } catch (error) {
      // 如果解析响应失败，直接返回原始响应
      return response
    }
  }
  
  return response
}


