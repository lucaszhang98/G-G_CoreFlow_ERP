import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { ContainerDetailClient } from "./container-detail-client"

interface ContainerDetailPageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function ContainerDetailPage({ params }: ContainerDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const resolvedParams = params instanceof Promise ? await params : params

  // 验证ID是否有效
  if (!resolvedParams.id || isNaN(Number(resolvedParams.id))) {
    notFound()
  }

  // 获取容器详情，包含所有关联数据
  let container
  try {
    container = await prisma.containers.findUnique({
      where: { container_id: BigInt(resolvedParams.id) },
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
                    drivers: true,
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
            return_carrier_service_level: {
              include: {
                carriers: {
                  include: {
                    drivers: true,
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
  } catch (error: any) {
    console.error('获取容器详情失败:', error)
    if (error?.code === 'P2025') {
      notFound()
    }
    throw new Error(`获取容器详情失败: ${error?.message || '未知错误'}`)
  }

  if (!container) {
    notFound()
  }

  // 序列化 BigInt 和 Date
  const serializedContainer = JSON.parse(JSON.stringify(container, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString()
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    return value
  }))

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
          <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/tms/containers">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    容器详情
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    容器ID: {String(container.container_id || '')}
                  </p>
                </div>
              </div>
            </div>

            {/* 容器详情内容 */}
            <ContainerDetailClient container={serializedContainer} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

