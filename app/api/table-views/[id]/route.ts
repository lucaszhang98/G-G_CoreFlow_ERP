/**
 * 单个表格视图配置 API
 * PUT /api/table-views/:id - 更新视图
 * DELETE /api/table-views/:id - 删除视图
 * PATCH /api/table-views/:id/default - 设置为默认视图
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'

const prisma = new PrismaClient()

/**
 * PUT /api/table-views/:id
 * 更新视图
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const viewId = BigInt(id)
    const body = await request.json()

    const {
      view_name,
      column_visibility,
      column_sizing,
      column_order,
      is_default,
    } = body

    // 验证权限：只能更新自己的视图
    const existingView = await prisma.table_views.findUnique({
      where: { id: viewId },
    })

    if (!existingView) {
      return NextResponse.json(
        { error: '视图不存在' },
        { status: 404 }
      )
    }

    if (existingView.user_id !== userId) {
      return NextResponse.json(
        { error: '无权限操作此视图' },
        { status: 403 }
      )
    }

    // 如果设置为默认视图，先取消该表的其他默认视图
    if (is_default && !existingView.is_default) {
      await prisma.table_views.updateMany({
        where: {
          user_id: userId,
          table_name: existingView.table_name,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      })
    }

    // 更新视图
    const view = await prisma.table_views.update({
      where: { id: viewId },
      data: {
        view_name: view_name || existingView.view_name,
        column_visibility: column_visibility || existingView.column_visibility,
        column_sizing: column_sizing !== undefined ? column_sizing : existingView.column_sizing,
        column_order: column_order || existingView.column_order,
        is_default: is_default !== undefined ? is_default : existingView.is_default,
        updated_at: new Date(),
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
      message: '视图更新成功',
    })
  } catch (error: any) {
    console.error('更新视图失败:', error)
    return NextResponse.json(
      { error: error.message || '更新视图失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/table-views/:id
 * 删除视图
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const viewId = BigInt(id)

    // 验证权限：只能删除自己的视图
    const existingView = await prisma.table_views.findUnique({
      where: { id: viewId },
    })

    if (!existingView) {
      return NextResponse.json(
        { error: '视图不存在' },
        { status: 404 }
      )
    }

    if (existingView.user_id !== userId) {
      return NextResponse.json(
        { error: '无权限操作此视图' },
        { status: 403 }
      )
    }

    // 删除视图
    await prisma.table_views.delete({
      where: { id: viewId },
    })

    return NextResponse.json({
      message: '视图删除成功',
    })
  } catch (error: any) {
    console.error('删除视图失败:', error)
    return NextResponse.json(
      { error: error.message || '删除视图失败' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/table-views/:id/default
 * 设置为默认视图
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const viewId = BigInt(id)

    // 验证权限
    const existingView = await prisma.table_views.findUnique({
      where: { id: viewId },
    })

    if (!existingView) {
      return NextResponse.json(
        { error: '视图不存在' },
        { status: 404 }
      )
    }

    if (existingView.user_id !== userId) {
      return NextResponse.json(
        { error: '无权限操作此视图' },
        { status: 403 }
      )
    }

    // 取消该表的其他默认视图
    await prisma.table_views.updateMany({
      where: {
        user_id: userId,
        table_name: existingView.table_name,
        is_default: true,
      },
      data: {
        is_default: false,
      },
    })

    // 设置为默认视图
    const view = await prisma.table_views.update({
      where: { id: viewId },
      data: {
        is_default: true,
        updated_at: new Date(),
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
      message: '已设置为默认视图',
    })
  } catch (error: any) {
    console.error('设置默认视图失败:', error)
    return NextResponse.json(
      { error: error.message || '设置默认视图失败' },
      { status: 500 }
    )
  }
}

