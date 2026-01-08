/**
 * 表格视图配置 API
 * GET /api/table-views?table=orders - 获取用户的视图列表
 * POST /api/table-views - 创建新视图
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'

const prisma = new PrismaClient()

/**
 * GET /api/table-views?table=orders
 * 获取当前用户指定表的所有视图
 */
export async function GET(request: NextRequest) {
  try {
    // 获取当前登录用户
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const userId = BigInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('table')

    if (!tableName) {
      return NextResponse.json(
        { error: '缺少参数: table' },
        { status: 400 }
      )
    }

    // 查询用户的视图列表
    const views = await prisma.table_views.findMany({
      where: {
        user_id: userId,
        table_name: tableName,
      },
      orderBy: [
        { is_default: 'desc' }, // 默认视图排在前面
        { updated_at: 'desc' },  // 最近更新的排在前面
      ],
    })

    // 序列化 BigInt
    const serializedViews = views.map((view) => ({
      id: view.id.toString(),
      user_id: view.user_id.toString(),
      table_name: view.table_name,
      view_name: view.view_name,
      column_visibility: view.column_visibility,
      column_sizing: view.column_sizing,
      column_order: view.column_order,
      is_default: view.is_default,
      created_at: view.created_at.toISOString(),
      updated_at: view.updated_at.toISOString(),
    }))

    return NextResponse.json({
      data: serializedViews,
      total: serializedViews.length,
    })
  } catch (error: any) {
    console.error('获取视图列表失败:', error)
    return NextResponse.json(
      { error: error.message || '获取视图列表失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/table-views
 * 创建新视图或更新现有视图
 */
export async function POST(request: NextRequest) {
  try {
    // 获取当前登录用户
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    const userId = BigInt(session.user.id)
    const body = await request.json()

    const {
      table_name,
      view_name,
      column_visibility,
      column_sizing,
      column_order,
      is_default,
    } = body

    // 验证必填字段
    if (!table_name || !view_name || !column_visibility || !column_order) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    // 如果设置为默认视图，先取消该表的其他默认视图
    if (is_default) {
      await prisma.table_views.updateMany({
        where: {
          user_id: userId,
          table_name: table_name,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      })
    }

    // 使用 upsert 创建或更新视图
    const view = await prisma.table_views.upsert({
      where: {
        user_id_table_name_view_name: {
          user_id: userId,
          table_name: table_name,
          view_name: view_name,
        },
      },
      update: {
        column_visibility: column_visibility,
        column_sizing: column_sizing || null,
        column_order: column_order,
        is_default: is_default || false,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        table_name: table_name,
        view_name: view_name,
        column_visibility: column_visibility,
        column_sizing: column_sizing || null,
        column_order: column_order,
        is_default: is_default || false,
      },
    })

    // 序列化响应
    const serializedView = {
      id: view.id.toString(),
      user_id: view.user_id.toString(),
      table_name: view.table_name,
      view_name: view.view_name,
      column_visibility: view.column_visibility,
      column_sizing: view.column_sizing,
      column_order: view.column_order,
      is_default: view.is_default,
      created_at: view.created_at.toISOString(),
      updated_at: view.updated_at.toISOString(),
    }

    return NextResponse.json({
      data: serializedView,
      message: '视图保存成功',
    })
  } catch (error: any) {
    console.error('保存视图失败:', error)
    return NextResponse.json(
      { error: error.message || '保存视图失败' },
      { status: 500 }
    )
  }
}

