import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { locationCreateSchema, locationUpdateSchema } from '@/lib/validations/location';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams);
    const search = searchParams.get('search') || '';
    const locationType = searchParams.get('location_type');

    const where: any = {};
    if (search) {
      where.OR = [
        { location_code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { address_line1: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (locationType) {
      where.location_type = locationType;
    }

    const [locations, total] = await Promise.all([
      prisma.locations.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.locations.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(locations),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取位置列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin', 'oms_manager', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = locationCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.location_code) {
      const existing = await prisma.locations.findUnique({
        where: { location_code: data.location_code },
      });
      if (existing) {
        return NextResponse.json(
          { error: '位置代码已存在' },
          { status: 409 }
        );
      }
    }

    const location = await prisma.locations.create({
      data: {
        location_code: data.location_code,
        name: data.name,
        location_type: data.location_type,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country,
        timezone: data.timezone,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
      },
    });

    return NextResponse.json(
      {
        data: serializeBigInt(location),
        message: '位置创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '位置代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建位置失败');
  }
}

