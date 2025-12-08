/**
 * 删除订单脚本
 * 运行方式: npx tsx scripts/delete-orders.ts
 * 
 * 删除所有订单及其关联的明细数据
 */

import prisma from '@/lib/prisma'

async function deleteOrders() {
  try {
    console.log('🔄 开始删除订单数据...\n')

    // 1. 先删除订单明细项（order_detail_item）
    console.log('📝 删除订单明细项...')
    const deletedItems = await prisma.order_detail_item.deleteMany({})
    console.log(`✅ 已删除 ${deletedItems.count} 条订单明细项\n`)

    // 2. 删除订单明细（order_detail）
    console.log('📝 删除订单明细...')
    const deletedDetails = await prisma.order_detail.deleteMany({})
    console.log(`✅ 已删除 ${deletedDetails.count} 条订单明细\n`)

    // 3. 删除订单（orders）
    console.log('📝 删除订单...')
    const deletedOrders = await prisma.orders.deleteMany({})
    console.log(`✅ 已删除 ${deletedOrders.count} 条订单\n`)

    console.log('✅ 所有订单数据删除完成！')
  } catch (error) {
    console.error('❌ 删除订单失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

deleteOrders()


