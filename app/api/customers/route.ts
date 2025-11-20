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
    const { page, limit, sort, order } = parsePaginationParams(searchParams, 'code', 'asc');
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

    // 转换数据格式，将 contact_roles 转换为 contact，并处理 credit_limit
    const transformedCustomers = customers.map((customer: any) => {
      const transformed = serializeBigInt(customer);
      // 将 contact_roles 转换为 contact（如果存在）
      // 注意：contact_roles 可能是一个对象（一对一关系）
      if (transformed.contact_roles) {
        transformed.contact = {
          name: transformed.contact_roles.name || "",
          phone: transformed.contact_roles.phone || null,
          email: transformed.contact_roles.email || null,
        };
        delete transformed.contact_roles;
      } else {
        // 如果没有 contact_roles，设置为 null
        transformed.contact = null;
      }
      // 确保 credit_limit 是字符串或 null
      // Decimal 类型在序列化后可能是对象，需要特殊处理
      if (transformed.credit_limit !== null && transformed.credit_limit !== undefined) {
        // 如果是对象（Decimal 类型），尝试获取其值
        if (typeof transformed.credit_limit === 'object' && 'toString' in transformed.credit_limit) {
          transformed.credit_limit = transformed.credit_limit.toString();
        } else {
          transformed.credit_limit = String(transformed.credit_limit);
        }
        // 如果转换后是 "null" 或 "undefined" 字符串，设置为 null
        if (transformed.credit_limit === "null" || transformed.credit_limit === "undefined" || transformed.credit_limit === "") {
          transformed.credit_limit = null;
        }
      } else {
        transformed.credit_limit = null;
      }
      return transformed;
    });

    return NextResponse.json(
      buildPaginationResponse(
        transformedCustomers,
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
    // 注意：数据库要求 contact_roles.name 非空，所以只有当提供了 name 时才创建联系人
    let contactId: bigint | null = null;
    if (data.contact && data.contact.name) {
      const contact = await prisma.contact_roles.create({
        data: {
          related_entity_type: 'customer',
          related_entity_id: BigInt(0), // 临时值，创建客户后会更新
          role: 'primary',
          name: data.contact.name,
          phone: data.contact.phone || null,
          email: data.contact.email || null,
          address_line1: data.contact.address_line1 || null,
          address_line2: data.contact.address_line2 || null,
          city: data.contact.city || null,
          state: data.contact.state || null,
          postal_code: data.contact.postal_code || null,
          country: data.contact.country || null,
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
