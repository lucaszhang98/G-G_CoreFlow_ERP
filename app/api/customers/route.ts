import { NextRequest, NextResponse } from 'next/server';
import { createListHandler } from '@/lib/crud/api-handler';
import { customerConfig } from '@/lib/crud/configs/customers';
import { checkPermission, handleValidationError, handleError, serializeBigInt, addSystemFields } from '@/lib/api/helpers';
import { customerCreateSchema } from '@/lib/validations/customer';
import prisma from '@/lib/prisma';

// GET - 获取客户列表（使用统一框架）
export const GET = createListHandler(customerConfig);

/**
 * POST /api/customers
 * 创建客户（保留自定义逻辑，因为需要特殊处理联系人）
 */
export async function POST(request: NextRequest) {
  try {
    // 检查权限
    const permissionResult = await checkPermission(['admin', 'oms_manager']);
    if (permissionResult.error) return permissionResult.error;
    const currentUser = permissionResult.user;

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

    // 使用事务确保数据一致性
    const customer = await prisma.$transaction(async (tx) => {
      // 先创建客户（不设置 contact_id）
      const customerData: any = {
        code: data.code,
        name: data.name,
        company_name: data.company_name,
        credit_limit: data.credit_limit !== undefined && data.credit_limit !== null ? data.credit_limit : 0, // 默认值为 0
        status: data.status,
        contact_id: null, // 先设置为 null，创建联系人后再更新
      };
      // 自动添加系统维护字段（在事务内部，跳过用户验证以避免嵌套查询）
      await addSystemFields(customerData, currentUser, true, true);
      
      const newCustomer = await tx.customers.create({
        data: customerData,
      });

      // 处理联系人信息（在客户创建后，使用正确的 customer.id）
      // 注意：数据库要求 contact_roles.name 非空，所以只有当提供了 name 时才创建联系人
      let contactId: bigint | null = null;
      if (data.contact && data.contact.name) {
        const contactData: any = {
          related_entity_type: 'customer',
          related_entity_id: newCustomer.id, // 使用正确的客户 ID
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
        };
        // 自动添加系统维护字段（在事务内部，跳过用户验证）
        await addSystemFields(contactData, currentUser, true, true);
        
        const contact = await tx.contact_roles.create({
          data: contactData,
        });
        contactId = contact.contact_id;

        // 更新客户的 contact_id
        await tx.customers.update({
          where: { id: newCustomer.id },
          data: { contact_id: contactId },
        });
      }

      // 返回包含联系人信息的客户数据
      return await tx.customers.findUnique({
        where: { id: newCustomer.id },
        include: {
          contact_roles: true,
        },
      });
    })

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
