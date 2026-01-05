/**
 * 拆柜单据 PDF 组件（使用 @react-pdf/renderer）
 * 
 * 布局（A4 竖排）：
 * - 标题：拆柜单据
 * - 主数据：柜号、拆柜人员、入库人员、拆柜日期
 * - 明细表格：性质、仓点、备注（详情页数据）、实际板数、库位、备注（留白）
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { UnloadSheetData } from './types'
import { PageSizes, formatDate } from './print-templates'
import path from 'path'
import fs from 'fs'

// 注册中文字体
// 优先使用 public/fonts 目录中的字体文件，如果不存在则尝试 node_modules
let fontRegistered = false
let fontError: any = null

function registerFont() {
  const cwd = process.cwd()
  // 优先使用 node_modules 中的 woff 文件（@react-pdf/renderer 支持 woff 和 ttf，但不支持 woff2）
  const fontPaths = [
    // 方案1: 使用 node_modules 中的 woff 字体（最可靠）
    path.join(cwd, 'node_modules', '@fontsource', 'noto-sans-sc', 'files', 'noto-sans-sc-chinese-simplified-400-normal.woff'),
    // 方案2: 使用 public/fonts 目录中的 woff 文件（如果存在）
    path.join(cwd, 'public', 'fonts', 'NotoSansSC-Regular.woff'),
  ]

  console.log('[UnloadSheet PDF] 字体注册开始:', {
    cwd,
    fontPaths,
  })

  for (const fontPath of fontPaths) {
    try {
      if (fs.existsSync(fontPath)) {
        // 验证文件确实是字体文件（不是 HTML 或其他格式）
        const stats = fs.statSync(fontPath)
        if (stats.size < 1000) {
          // 文件太小，可能是 HTML 错误页面
          console.warn(`[UnloadSheet PDF] 字体文件太小，跳过: ${fontPath} (${stats.size} bytes)`)
          continue
        }
        
        console.log(`[UnloadSheet PDF] 找到字体文件: ${fontPath} (${stats.size} bytes)`)
        Font.register({
          family: 'NotoSansSC',
          src: fontPath,
        })
        fontRegistered = true
        console.log('[UnloadSheet PDF] 字体注册成功')
        return
      } else {
        console.log(`[UnloadSheet PDF] 字体文件不存在: ${fontPath}`)
      }
    } catch (error: any) {
      console.warn(`[UnloadSheet PDF] 尝试注册字体失败 (${fontPath}):`, {
        message: error?.message,
        path: fontPath,
        errorType: error?.constructor?.name,
      })
      // 继续尝试下一个路径
    }
  }

  // 所有路径都失败
  const errorMsg = '所有字体文件路径都不可用，中文可能显示为乱码'
  console.error(`[UnloadSheet PDF] ${errorMsg}`, {
    cwd,
    triedPaths: fontPaths,
  })
  fontError = { message: errorMsg, triedPaths: fontPaths, cwd }
}

try {
  registerFont()
} catch (error: any) {
  const errorMsg = '字体注册过程发生异常'
  console.error(`[UnloadSheet PDF] ${errorMsg}:`, {
    message: error?.message,
    stack: error?.stack,
  })
  fontError = error
}

// 页面尺寸（A4 横排：297mm x 210mm）
const PAGE_WIDTH = PageSizes.A4_LANDSCAPE.width // 297mm
const PAGE_HEIGHT = PageSizes.A4_LANDSCAPE.height // 210mm

/**
 * 创建固定样式（不再动态缩放）
 * 保持字体大小不变，允许分页
 */
const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    paddingTop: 0, // 上下不留白
    paddingBottom: 0,
    paddingLeft: 12,
    paddingRight: 12,
    fontFamily: fontRegistered ? 'NotoSansSC' : 'Helvetica',
  },
  title: {
    fontSize: 24, // 固定字体大小
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  headerSection: {
    marginBottom: 15,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
  },
  headerItem: {
    flex: 1,
    marginRight: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  headerLabel: {
    fontSize: 13.5, // 固定字体大小
    color: '#666',
    marginBottom: 3,
  },
  headerValue: {
    fontSize: 15, // 固定字体大小
    fontWeight: 'bold',
    wordBreak: 'keep-all',
    overflow: 'hidden',
  },
  table: {
    marginTop: 7.5,
    borderWidth: 1,
    borderColor: '#000',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tableHeaderCell: {
    padding: 12, // 固定padding
    fontSize: 33, // 固定字体大小
    fontWeight: 'bold',
    borderRightWidth: 1,
    borderRightColor: '#000',
    textAlign: 'center',
    lineHeight: 2.25, // 固定行高
    overflow: 'hidden',
    wordBreak: 'keep-all',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableCell: {
    padding: 12, // 固定padding
    fontSize: 33, // 固定字体大小
    borderRightWidth: 1,
    borderRightColor: '#ccc',
    textAlign: 'center',
    lineHeight: 2.25, // 固定行高
    overflow: 'hidden',
    wordBreak: 'keep-all',
  },
  // 列宽定义（7列）
  col1: { width: '8%' },  // 性质
  col2: { width: '18%' }, // 仓点
  col3: { width: '10%' }, // 数量
  col4: { width: '16%' }, // 备注
  col5: { width: '16%' }, // 实际板数
  col6: { width: '16%' }, // 库位
  col7: { width: '16%' }, // 备注
})

/**
 * 拆柜单据 PDF 文档
 */
export function UnloadSheetDocument({ data }: { data: UnloadSheetData }) {
  const rowCount = data.orderDetails.length
  console.log('[UnloadSheet PDF Component] 渲染文档:', {
    rowCount,
    containerNumber: data.containerNumber,
    fontRegistered,
    fontError: fontError ? { message: fontError.message } : null,
  })
  
  return (
    <Document>
      {/* 使用标准A4横向尺寸，允许分页，至少一页 */}
      <Page 
        size="A4" 
        orientation="landscape" 
        style={styles.page}
        wrap={true} // 允许自动换页
      >
        {/* 标题 */}
        <Text style={styles.title}>拆柜单据</Text>

        {/* 主数据 */}
        <View style={styles.headerSection}>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>柜号：</Text>
            <Text style={styles.headerValue}>{data.containerNumber || '-'}</Text>
          </View>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>拆柜人员：</Text>
            <Text style={styles.headerValue}>{data.unloadedBy || '-'}</Text>
          </View>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>入库人员：</Text>
            <Text style={styles.headerValue}>{data.receivedBy || '-'}</Text>
          </View>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>拆柜日期：</Text>
            <Text style={styles.headerValue}>
              {data.unloadDate ? formatDate(data.unloadDate, 'short') : '-'}
            </Text>
          </View>
        </View>

        {/* 明细表格 */}
        <View style={styles.table}>
          {/* 表头 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.col1]}>性质</Text>
            <Text style={[styles.tableHeaderCell, styles.col2]}>仓点</Text>
            <Text style={[styles.tableHeaderCell, styles.col3]}>数量</Text>
            <Text style={[styles.tableHeaderCell, styles.col4]}>备注</Text>
            <Text style={[styles.tableHeaderCell, styles.col5]}>实际板数</Text>
            <Text style={[styles.tableHeaderCell, styles.col6]}>库位</Text>
            <Text style={[styles.tableHeaderCell, styles.col7]}>备注</Text>
          </View>

          {/* 表格行 */}
          {data.orderDetails.map((detail, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.col1]}>
                {detail.deliveryNature || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.col2]}>
                {(() => {
                  let location = detail.deliveryLocation || '-'
                  // 如果性质是转仓，仓点后加+
                  if (detail.deliveryNature === '转仓') {
                    location += '+'
                  }
                  // 如果性质是扣货，仓点后加-hold
                  else if (detail.deliveryNature === '扣货') {
                    location += '-hold'
                  }
                  return location
                })()}
              </Text>
              <Text style={[styles.tableCell, styles.col3]}>
                {detail.quantity !== undefined ? detail.quantity.toString() : '-'}
              </Text>
              <Text style={[styles.tableCell, styles.col4]}>
                {detail.notes || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.col5]}>
                {detail.actualPallets !== undefined ? detail.actualPallets.toString() : ''}
              </Text>
              <Text style={[styles.tableCell, styles.col6]}>
                {detail.storageLocation || ''}
              </Text>
              <Text style={[styles.tableCell, styles.col7]}>
                {detail.workerNotes || ''}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}

