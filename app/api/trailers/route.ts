import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, checkPermission, parsePaginationParams, buildPaginationResponse, handleValidationError, handleError, serializeBigInt } from '@/lib/api/helpers';
import { trailerCreateSchema, trailerUpdateSchema } from '@/lib/validations/trailer';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuth();
    if (authResult.error) return authResult.error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, sort, order } = parsePaginationParams(searchParams);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('department_id');
    const status = searchParams.get('status');

    const where: any = {};
    if (search) {
      where.trailer_code = { contains: search, mode: 'insensitive' as const };
    }
    if (departmentId) {
      where.department_id = BigInt(departmentId);
    }
    if (status) {
      where.status = status;
    }

    const [trailers, total] = await Promise.all([
      prisma.trailers.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          departments: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.trailers.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginationResponse(
        serializeBigInt(trailers),
        total,
        page,
        limit
      )
    );
  } catch (error) {
    return handleError(error, '获取货柜列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(['admin', 'tms_manager', 'wms_manager']);
    if (permissionResult.error) return permissionResult.error;

    const body = await request.json();
    const validationResult = trailerCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return handleValidationError(validationResult.error);
    }

    const data = validationResult.data;

    if (data.trailer_code) {
      const existing = await prisma.trailers.findUnique({
        where: { trailer_code: data.trailer_code },
      });
      if (existing) {
        return NextResponse.json(
          { error: '货柜代码已存在' },
          { status: 409 }
        );
      }
    }

    const trailer = await prisma.trailers.create({
      data: {
        trailer_code: data.trailer_code,
        trailer_type: data.trailer_type,
        length_feet: data.length_feet,
        capacity_weight: data.capacity_weight,
        capacity_volume: data.capacity_volume,
        status: data.status,
        department_id: data.department_id ? BigInt(data.department_id) : null,
        notes: data.notes,
      },
    });

    return NextResponse.json(
      {
        data: serializeBigInt(trailer),
        message: '货柜创建成功',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '货柜代码已存在' },
        { status: 409 }
      );
    }
    return handleError(error, '创建货柜失败');
  }
}

