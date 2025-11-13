import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { driverCreateSchema, driverUpdateSchema } from '@/lib/validations/driver';
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
        { driver_code: { contains: search, mode: 'insensitive' as const } },
        { license_number: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (carrierId) {
      where.carrier_id = BigInt(carrierId);
    }
    if (status) {
      where.status = status;
    }

    const [drivers, total] = await Promise.all([
      prisma.drivers.findMany({
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
          contact_roles: {
            select: {
              contact_id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      prisma.drivers.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(drivers),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取司机列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = driverCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查代码和驾驶证号是否已存在
    if (data.driver_code) {
      const existing = await prisma.drivers.findUnique({
        where: { driver_code: data.driver_code },
      });
      if (existing) {
        return NextResponse.json(
          { error: '司机代码已存在' },
          { status: 409 }
        );
      }
    }

    // 处理联系人
    let contactId: bigint | null = null;
    if (data.contact) {
      const contact = await prisma.contact_roles.create({
        data: {
          related_entity_type: 'driver',
          related_entity_id: BigInt(0),
          role: 'primary',
          name: data.contact.name,
          phone: data.contact.phone,
          email: data.contact.email,
          address_line1: data.contact.address_line1,
          address_line2: data.contact.address_line2,
          city: data.contact.city,
          state: data.contact.state,
          postal_code: data.contact.postal_code,
          country: data.contact.country,
        },
      });
      contactId = contact.contact_id;
    }

    const driver = await prisma.drivers.create({
      data: {
        driver_code: data.driver_code,
        license_number: data.license_number,
        license_expiration: data.license_expiration ? new Date(data.license_expiration) : null,
        status: data.status,
        carrier_id: data.carrier_id ? BigInt(data.carrier_id) : null,
        contact_id: contactId,
        notes: data.notes,
      },
    });

    if (contactId) {
      await prisma.contact_roles.update({
        where: { contact_id: contactId },
        data: { related_entity_id: driver.driver_id },
      });
    }

    return NextResponse.json(
      {
        data: serializeBigInt(driver),
        message: '司机创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '司机代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建司机失败');
  }
}

