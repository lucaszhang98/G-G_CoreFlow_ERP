import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { customerCreateSchema, customerUpdateSchema } from '@/lib/validations/customer';
import prisma from '@/lib/prisma';

/**
 * GET /api/customers
 * 获取客户列表
 */
export async function GET(request: NextRequest) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    // 构建查询条件
    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { company_name: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (status) {
      where.status = status;
    }

    // 查询数据
    const [customers, total] = await Promise.all([
      prisma.customers.findMany({
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
      prisma.customers.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(customers),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取客户列表失败');
  }
}

/**
 * POST /api/customers
 * 创建客户
 */
export async function POST(request: NextRequest) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin', 'oms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();

    // 验证数据
    const validationResult = customerCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 检查代码是否已存在
    const existing = await prisma.customers.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: '客户代码已存在' },
        { status: 409 }
      );
    }

    // 处理联系人信息
    let contactId: bigint | null = null;
    if (data.contact) {
      const contact = await prisma.contact_roles.create({
        data: {
          related_entity_type: 'customer',
          related_entity_id: BigInt(0), // 临时值，创建客户后会更新
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

    // 创建客户
    const customer = await prisma.customers.create({
      data: {
        code: data.code,
        name: data.name,
        company_name: data.company_name,
        credit_limit: data.credit_limit,
        status: data.status,
        contact_id: contactId,
      },
      include: {
        contact_roles: true,
      },
    });

    // 更新联系人的 related_entity_id
    if (contactId) {
      await prisma.contact_roles.update({
        where: { contact_id: contactId },
        data: { related_entity_id: customer.id },
      });
    }

    return NextResponse.json(
      {
        data: serializeBigInt(customer),
        message: '客户创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '客户代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建客户失败');
  }
}
