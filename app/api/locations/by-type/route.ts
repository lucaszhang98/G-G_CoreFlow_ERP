import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, serializeBigInt } from '@/lib/api/helpers';
import prisma from '@/lib/prisma';

/**
 * GET - 根据位置类型获取位置列表
 * Query params:
 *   - type: 位置类型 (port, amazon, warehouse)
 */
export async function GET(request: NextRequest) {
  try {
    // 检查登录
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search') || '';

    if (!type) {
      return NextResponse.json(
        { error: '缺少位置类型参数' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: any = {
      location_type: type,
    };

    // 如果有搜索条件，进行模糊搜索
    if (search && search.trim()) {
      where.OR = [
        { location_code: { contains: search.trim(), mode: 'insensitive' as const } },
        { name: { contains: search.trim(), mode: 'insensitive' as const } },
      ];
    }

    // 查询数据
    // 如果有搜索条件，返回所有匹配结果；否则限制返回前5000条
    const takeLimit = search && search.trim() ? 50000 : 5000;
    const items = await prisma.locations.findMany({
      where,
      orderBy: [
        { location_code: 'asc' },
        { name: 'asc' },
      ],
      take: takeLimit,
    });

    // 序列化
    const serializedItems = items.map((item: any) => serializeBigInt(item));

    return NextResponse.json({
      data: serializedItems,
      total: serializedItems.length,
    });
  } catch (error: any) {
    console.error('获取位置列表失败:', error);
    return NextResponse.json(
      { error: '获取位置列表失败' },
      { status: 500 }
    );
  }
}


