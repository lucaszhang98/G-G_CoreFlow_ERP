/**
 * 检查订单明细表中是否存在重复的明细行
 * 
 * 重复定义：同一订单号(order_id)下，相同的"仓点(delivery_location)+性质(delivery_nature)"组合
 */

import prisma from '../lib/prisma'

async function checkDuplicateOrderDetails() {
  console.log('🔍 开始检查订单明细表中的重复数据...\n')

  try {
    // 查询重复的明细行
    const duplicates = await prisma.$queryRaw<Array<{
      order_id: bigint
      order_number: string
      delivery_location: string
      delivery_nature: string
      count: bigint
      total_quantity: number
      total_volume: number
      detail_ids: string
    }>>`
      SELECT 
        od.order_id,
        o.order_number,
        od.delivery_location,
        od.delivery_nature,
        COUNT(*) as count,
        SUM(od.quantity) as total_quantity,
        SUM(od.volume) as total_volume,
        STRING_AGG(od.detail_id::text, ', ' ORDER BY od.detail_id) as detail_ids
      FROM order_detail od
      JOIN orders o ON o.order_id = od.order_id
      GROUP BY od.order_id, o.order_number, od.delivery_location, od.delivery_nature
      HAVING COUNT(*) > 1
      ORDER BY o.order_number, od.delivery_location, od.delivery_nature
    `

    if (duplicates.length === 0) {
      console.log('✅ 太好了！没有发现重复的明细行！')
      console.log('   数据完整性良好，所有订单的"仓点+性质"组合都是唯一的。\n')
      return
    }

    // 发现重复数据
    console.log(`⚠️  发现 ${duplicates.length} 组重复的明细行！\n`)
    console.log('详细信息：\n')
    console.log('=' .repeat(120))

    let totalDuplicateRows = 0

    for (const dup of duplicates) {
      const count = Number(dup.count)
      totalDuplicateRows += count

      // 获取仓点名称
      const location = await prisma.locations.findFirst({
        where: { location_id: BigInt(dup.delivery_location) },
        select: { location_code: true, name: true }
      })

      console.log(`📦 订单号: ${dup.order_number} (ID: ${dup.order_id})`)
      console.log(`   仓点: ${location?.location_code || dup.delivery_location} (${location?.name || '未知'})`)
      console.log(`   性质: ${dup.delivery_nature}`)
      console.log(`   重复次数: ${count} 条明细记录`)
      console.log(`   合计数量: ${dup.total_quantity}`)
      console.log(`   合计体积: ${dup.total_volume}`)
      console.log(`   明细行ID: ${dup.detail_ids}`)
      console.log('-'.repeat(120))
    }

    console.log('\n📊 统计摘要：')
    console.log(`   - 受影响的订单数: ${new Set(duplicates.map(d => d.order_number)).size} 个订单`)
    console.log(`   - 重复组合数: ${duplicates.length} 组`)
    console.log(`   - 重复明细行总数: ${totalDuplicateRows} 条`)
    console.log(`   - 应该保留的记录数: ${duplicates.length} 条（每组合并成1条）`)
    console.log(`   - 可以清理的冗余记录: ${totalDuplicateRows - duplicates.length} 条\n`)

    console.log('💡 建议：')
    console.log('   1. 如果这些重复数据是历史遗留问题，可以运行清理脚本合并它们')
    console.log('   2. 已添加的导入验证会防止新的重复数据产生')
    console.log('   3. 合并时应该将数量和体积累加\n')

  } catch (error) {
    console.error('❌ 检查过程中出错:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行检查
checkDuplicateOrderDetails()
  .then(() => {
    console.log('✅ 检查完成！')
    process.exit(0)
  })
  .catch((error) => {
    console.error('检查失败:', error)
    process.exit(1)
  })

