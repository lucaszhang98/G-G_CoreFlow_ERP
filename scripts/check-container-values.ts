import prisma from '../lib/prisma'

async function checkContainerValues() {
  try {
    // 查询所有不同的 status 值
    const statusValues = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT DISTINCT status 
      FROM tms.containers 
      WHERE status IS NOT NULL
      ORDER BY status
    `

    // 查询所有不同的 source_type 值
    const sourceTypeValues = await prisma.$queryRaw<Array<{ source_type: string }>>`
      SELECT DISTINCT source_type 
      FROM tms.containers 
      WHERE source_type IS NOT NULL
      ORDER BY source_type
    `

    console.log('\n=== 数据库中的实际值 ===\n')
    console.log('Status 值:')
    statusValues.forEach(item => {
      console.log(`  - ${item.status}`)
    })

    console.log('\nSource Type 值:')
    sourceTypeValues.forEach(item => {
      console.log(`  - ${item.source_type}`)
    })

    console.log('\n=== 当前前端映射 ===\n')
    console.log('Status 映射: planned, in_transit, delivered, completed, cancelled')
    console.log('Source Type 映射: sea_container, trailer')

    process.exit(0)
  } catch (error) {
    console.error('查询失败:', error)
    process.exit(1)
  }
}

checkContainerValues()

