import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, handleValidationError, handleError } from '@/lib/api/helpers';
import { resetPasswordSchema } from '@/lib/validations/user';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * POST /api/users/:id/reset-password
 * 重置用户密码
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 检查权限（只有 admin 可以重置密码）
    const permissionResult = await checkPermission(['admin']);
    if (permissionResult.error) return permissionResult.error;

    // 检查用户是否存在
    const user = await prisma.users.findUnique({
      where: { id: BigInt(params.id) },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 验证数据
    const validationResult = resetPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    // 哈希新密码
    const passwordHash = await bcrypt.hash(validationResult.data.new_password, 10);

    // 更新密码
    await prisma.users.update({
      where: { id: BigInt(params.id) },
      data: {
        password_hash: passwordHash,
      },
    });

    return NextResponse.json({
      message: '密码重置成功',
    });
  } catch (error) {
    return handleError(error, '重置密码失败');
  }
}

