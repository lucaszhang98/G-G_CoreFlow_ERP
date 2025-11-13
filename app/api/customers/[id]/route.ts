import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { customerUpdateSchema } from '@/lib/validations/customer';
import prisma from '@/lib/prisma';

/**
 * GET /api/customers/:id
 * 获取客户详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const customer = await prisma.customers.findUnique({
      where: { id: BigInt(params.id) },
      include: {
        contact_roles: true,
        orders: {
          take: 10,
          orderBy: { order_date: 'desc' },
          select: {
            order_id: true,
            order_number: true,
            order_date: true,
            status: true,
            total_amount: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: serializeBigInt(customer),
    });
  } catch (error) {
    return handleError(error, '获取客户详情失败');
  }
}

/**
 * PUT /api/customers/:id
 * 更新客户
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin', 'oms_manager']);
    if (permissionResult.error) return permissionResult.error;

    // 检查客户是否存在
    const existing = await prisma.customers.findUnique({
      where: { id: BigInt(params.id) },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 验证数据
    const validationResult = customerUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    // 如果修改了代码，检查是否冲突
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.customers.findUnique({
        where: { code: data.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: '客户代码已存在' },
          { status: 409 }
        );
      }
    }

    // 更新客户
    const updateData: any = {};

    if (data.code) updateData.code = data.code;
    if (data.name) updateData.name = data.name;
    if (data.company_name !== undefined) updateData.company_name = data.company_name;
    if (data.credit_limit !== undefined) updateData.credit_limit = data.credit_limit;
    if (data.status) updateData.status = data.status;

    // 处理联系人更新
    if (data.contact) {
      if (existing.contact_id) {
        // 更新现有联系人
        await prisma.contact_roles.update({
          where: { contact_id: existing.contact_id },
          data: {
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
      } else {
        // 创建新联系人
        const contact = await prisma.contact_roles.create({
          data: {
            related_entity_type: 'customer',
            related_entity_id: existing.id,
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
        updateData.contact_id = contact.contact_id;
      }
    }

    const customer = await prisma.customers.update({
      where: { id: BigInt(params.id) },
      data: updateData,
      include: {
        contact_roles: true,
      },
    });

    return NextResponse.json({
      data: serializeBigInt(customer),
      message: '客户更新成功',
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '客户代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '更新客户失败');
  }
}

/**
 * DELETE /api/customers/:id
 * 删除客户
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    // 检查客户是否存在
    const customer = await prisma.customers.findUnique({
      where: { id: BigInt(params.id) },
      include: {
        orders: {
          take: 1,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: '客户不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联订单
    if (customer.orders.length > 0) {
      return NextResponse.json(
        { error: '客户有关联订单，无法删除' },
        { status: 409 }
      );
    }

    // 删除联系人（如果存在）
    if (customer.contact_id) {
      await prisma.contact_roles.delete({
        where: { contact_id: customer.contact_id },
      });
    }

    // 删除客户
    await prisma.customers.delete({
      where: { id: BigInt(params.id) },
    });

    return NextResponse.json({
      message: '客户删除成功',
    });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '客户有关联数据，无法删除' },
        { status: 409 }
      );
    }
    return handleError(error, '删除客户失败');
  }
}

