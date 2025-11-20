import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleError, serializeBigInt } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

/**
 * GET /api/drivers/by-service-level/:service_level_id
 * 根据服务级别获取司机列表
 * 
 * 关联路径：carrier_service_levels → carriers → drivers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service_level_id: string }> | { service_level_id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const serviceLevelId = BigInt(resolvedParams.service_level_id);

    // 查询服务级别是否存在
    const serviceLevel = await prisma.carrier_service_levels.findUnique({
      where: { service_level_id: serviceLevelId },
      include: {
        carriers: {
          include: {
            drivers: {
              include: {
                contact_roles: {
                  select: {
                    contact_id: true,
                    name: true,
                    phone: true,
                    email: true,
                    address_line1: true,
                    city: true,
                    state: true,
                    postal_code: true,
                    country: true,
                  },
                },
              },
              where: {
                status: 'active', // 只返回活跃状态的司机
              },
            },
          },
        },
      },
    });

    if (!serviceLevel) {
      return NextResponse.json(
        { error: '服务级别不存在' },
        { status: 404 }
      );
    }

    // 提取该服务级别对应的承运商下的所有司机
    const drivers = serviceLevel.carriers?.drivers || [];

    return NextResponse.json({
      data: serializeBigInt(drivers.map(driver => ({
        driver_id: driver.driver_id,
        driver_code: driver.driver_code,
        license_number: driver.license_number,
        license_expiration: driver.license_expiration,
        status: driver.status,
        carrier: {
          carrier_id: serviceLevel.carriers?.carrier_id,
          carrier_code: serviceLevel.carriers?.carrier_code,
          name: serviceLevel.carriers?.name,
        },
        contact: driver.contact_roles ? {
          contact_id: driver.contact_roles.contact_id,
          name: driver.contact_roles.name,
          phone: driver.contact_roles.phone,
          email: driver.contact_roles.email,
          address_line1: driver.contact_roles.address_line1,
          city: driver.contact_roles.city,
          state: driver.contact_roles.state,
          postal_code: driver.contact_roles.postal_code,
          country: driver.contact_roles.country,
        } : null,
        notes: driver.notes,
      }))),
    });
  } catch (error) {
    return handleError(error, '获取司机列表失败');
  }
}



