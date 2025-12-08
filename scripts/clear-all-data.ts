/**
 * 清空 Neon 数据库中的所有测试数据
 * 警告：此操作会删除所有表中的数据，但保留表结构
 * 运行方式: npx tsx scripts/clear-all-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearAllData() {
  try {
    console.log('⚠️  开始清空数据库中的所有数据...')
    console.log('⚠️  警告：此操作将删除所有表中的数据，但保留表结构！')
    console.log('')
    
    // 使用 SQL TRUNCATE CASCADE 来清空所有表
    // 这样可以自动处理外键约束，并且比逐条删除快得多
    console.log('正在清空数据...')
    
    // 按照 schema 分组清空
    const truncateQueries = [
      // OMS Schema
      'TRUNCATE TABLE oms.appointment_detail_lines CASCADE',
      'TRUNCATE TABLE oms.order_allocations CASCADE',
      'TRUNCATE TABLE oms.order_requirements CASCADE',
      'TRUNCATE TABLE oms.delivery_appointments CASCADE',
      
      // WMS Schema
      'TRUNCATE TABLE wms.outbound_shipment_lines CASCADE',
      'TRUNCATE TABLE wms.outbound_shipments CASCADE',
      'TRUNCATE TABLE wms.inventory_lots CASCADE',
      'TRUNCATE TABLE wms.inbound_receipt CASCADE',
      'TRUNCATE TABLE wms.putaway_tasks CASCADE',
      'TRUNCATE TABLE wms.wms_labor_logs CASCADE',
      
      // TMS Schema
      'TRUNCATE TABLE tms.container_legs CASCADE',
      'TRUNCATE TABLE tms.containers CASCADE',
      'TRUNCATE TABLE tms.freight_bills CASCADE',
      
      // Public Schema - 业务数据表
      'TRUNCATE TABLE public.order_detail_item CASCADE',
      'TRUNCATE TABLE public.order_detail CASCADE',
      'TRUNCATE TABLE public.orders CASCADE',
      'TRUNCATE TABLE public.events_log CASCADE',
      'TRUNCATE TABLE public.document_links CASCADE',
      'TRUNCATE TABLE public.contact_roles CASCADE',
      'TRUNCATE TABLE public.customers CASCADE',
      'TRUNCATE TABLE public.locations CASCADE',
      'TRUNCATE TABLE public.warehouses CASCADE',
      'TRUNCATE TABLE public.carriers CASCADE',
      'TRUNCATE TABLE public.drivers CASCADE',
      'TRUNCATE TABLE public.vehicles CASCADE',
      'TRUNCATE TABLE public.trailers CASCADE',
      'TRUNCATE TABLE public.carrier_service_levels CASCADE',
      'TRUNCATE TABLE public.delivery_status_codes CASCADE',
      'TRUNCATE TABLE public.unload_methods CASCADE',
      'TRUNCATE TABLE public.shift_dim CASCADE',
      'TRUNCATE TABLE public.users CASCADE',
      'TRUNCATE TABLE public.departments CASCADE',
      'TRUNCATE TABLE public.calendar_dim CASCADE',
    ]
    
    // 执行所有 TRUNCATE 语句
    for (const query of truncateQueries) {
      try {
        await prisma.$executeRawUnsafe(query)
        const tableName = query.match(/TABLE\s+[\w.]+\.(\w+)/)?.[1] || query.match(/TABLE\s+(\w+)/)?.[1] || 'unknown'
        const schema = query.match(/TABLE\s+(\w+)\./)?.[1] || 'public'
        console.log(`✓ 已清空 ${tableName} (${schema})`)
      } catch (error: any) {
        // 如果表不存在或已经为空，继续执行
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          const tableName = query.match(/TABLE\s+[\w.]+\.(\w+)/)?.[1] || query.match(/TABLE\s+(\w+)/)?.[1] || 'unknown'
          console.log(`⚠ 跳过 ${tableName} (表不存在或已为空)`)
        } else {
          throw error
        }
      }
    }
    
    console.log('')
    console.log('✅ 数据库清空完成！')
    console.log('✅ 所有测试数据已删除')
    console.log('✅ 表结构已保留，可以继续使用')
    console.log('')
    console.log('⚠️  请确保重新创建必要的用户账号和基础数据')
    
  } catch (error) {
    console.error('❌ 清空数据库失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行清空操作
clearAllData()
