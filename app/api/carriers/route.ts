import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { carrierCreateSchema, carrierUpdateSchema } from '@/lib/validations/carrier';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams);
    const search = searchParams.get('search') || '';
    const carrierType = searchParams.get('carrier_type');

    const where: any = {};
    if (search) {
      where.OR = [
        { carrier_code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (carrierType) {
      where.carrier_type = carrierType;
    }

    const [carriers, total] = await Promise.all([
      prisma.carriers.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
        include: {
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
      prisma.carriers.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(carriers),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取承运商列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = carrierCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.carrier_code) {
      const existing = await prisma.carriers.findUnique({
        where: { carrier_code: data.carrier_code },
      });
      if (existing) {
        return NextResponse.json(
          { error: '承运商代码已存在' },
          { status: 409 }
        );
      }
    }

    // 处理联系人
    let contactId: bigint | null = null;
    if (data.contact) {
      const contact = await prisma.contact_roles.create({
        data: {
          related_entity_type: 'carrier',
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

    const carrier = await prisma.carriers.create({
      data: {
        carrier_code: data.carrier_code,
        name: data.name,
        carrier_type: data.carrier_type,
        contact_id: contactId,
      },
    });

    if (contactId) {
      await prisma.contact_roles.update({
        where: { contact_id: contactId },
        data: { related_entity_id: carrier.carrier_id },
      });
    }

    return NextResponse.json(
      {
        data: serializeBigInt(carrier),
        message: '承运商创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '承运商代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建承运商失败');
  }
}

