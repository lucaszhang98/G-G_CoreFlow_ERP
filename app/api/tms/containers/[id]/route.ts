import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/api/helpers'

// GET - 获取容器详情（包含所有关联数据）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const resolvedParams = params instanceof Promise ? await params : params
    const containerId = resolvedParams.id

    if (!containerId || isNaN(Number(containerId))) {
      return NextResponse.json({ error: '无效的容器ID' }, { status: 400 })
    }

    // 查询容器详情，包含所有关联数据
    const container = await prisma.containers.findUnique({
      where: { container_id: BigInt(containerId) },
      include: {
        orders: {
          include: {
            customers: {
              select: {
                id: true,
                code: true,
                name: true,
                company_name: true,
              },
            },
            pickup_carrier_service_level: {
              include: {
                carriers: {
                  include: {
                    drivers: {
                      include: {
                        contact_roles: {
                          select: {
                            name: true,
                            phone: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            return_carrier_service_level: {
              include: {
                carriers: {
                  include: {
                    drivers: {
                      include: {
                        contact_roles: {
                          select: {
                            name: true,
                            phone: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            delivery_appointments: {
              include: {
                users_created: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        container_legs: {
          include: {
            locations_origin: {
              select: {
                location_id: true,
                name: true,
                location_type: true,
              },
            },
            locations_destination: {
              select: {
                location_id: true,
                name: true,
              },
            },
          },
          orderBy: {
            sequence_number: 'asc',
          },
        },
        trailers: {
          select: {
            trailer_id: true,
            trailer_code: true,
            trailer_type: true,
          },
        },
      },
    })

    if (!container) {
      return NextResponse.json({ error: '容器不存在' }, { status: 404 })
    }

    return NextResponse.json({
      data: serializeBigInt(container),
    })
  } catch (error: any) {
    console.error('获取容器详情失败:', error)
    return NextResponse.json(
      { error: error.message || '获取容器详情失败' },
      { status: 500 }
    )
  }
}


