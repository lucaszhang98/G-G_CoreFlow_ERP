import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { vehicleCreateSchema, vehicleUpdateSchema } from '@/lib/validations/vehicle';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams);
    const search = searchParams.get('search') || '';
    const carrierId = searchParams.get('carrier_id');
    const status = searchParams.get('status');

    const where: any = {};
    if (search) {
      where.OR = [
        { vehicle_code: { contains: search, mode: 'insensitive' as const } },
        { plate_number: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (carrierId) {
      where.carrier_id = BigInt(carrierId);
    }
    if (status) {
      where.status = status;
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicles.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          carriers: {
            select: {
              carrier_id: true,
              name: true,
            },
          },
        },
      }),
      prisma.vehicles.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(vehicles),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取车辆列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = vehicleCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查代码和车牌号是否已存在
    if (data.vehicle_code) {
      const existing = await prisma.vehicles.findUnique({
        where: { vehicle_code: data.vehicle_code },
      });
      if (existing) {
        return NextResponse.json(
          { error: '车辆代码已存在' },
          { status: 409 }
        );
      }
    }

    if (data.plate_number) {
      const existing = await prisma.vehicles.findUnique({
        where: { plate_number: data.plate_number },
      });
      if (existing) {
        return NextResponse.json(
          { error: '车牌号已存在' },
          { status: 409 }
        );
      }
    }

    const vehicle = await prisma.vehicles.create({
      data: {
        vehicle_code: data.vehicle_code,
        plate_number: data.plate_number,
        vehicle_type: data.vehicle_type,
        vin: data.vin,
        capacity_weight: data.capacity_weight,
        capacity_volume: data.capacity_volume,
        status: data.status,
        carrier_id: data.carrier_id ? BigInt(data.carrier_id) : null,
        notes: data.notes,
      },
    });

    return NextResponse.json(
      {
        data: serializeBigInt(vehicle),
        message: '车辆创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return NextResponse.json(
        { error: `${field === 'vehicle_code' ? '车辆代码' : '车牌号'}已存在` },
        { status: 409 }
      );
    }
    return handleError(error, '创建车辆失败');
  }
}

