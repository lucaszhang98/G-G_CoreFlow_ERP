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

// 固定高度分配（单位：mm，转换为点）
const TITLE_HEIGHT = 8 // 标题区域高度
const HEADER_HEIGHT = 10 // 主数据区域高度
const PADDING = 12 // 页面padding
const AVAILABLE_HEIGHT = PAGE_HEIGHT - (PADDING * 2) - TITLE_HEIGHT - HEADER_HEIGHT // 表格可用高度

/**
 * 根据数据行数计算缩放比例，确保内容在一页内显示
 * 强制条件：无论有多少行，都必须在一页内显示，不能分页
 * 注意：整体放大50%后，行高计算也需要相应调整
 */
function calculateScaleFactor(rowCount: number): number {
  // 基础行高（单位：点/毫米）- 整体放大50%后的计算
  // padding: 12点（放大50%），字体高度: 33点（放大50%），lineHeight: 2.25（放大50%），border: 1点
  // 实际行高 = padding * 2 + 字体高度 * lineHeight + border
  const baseRowHeight = (12 * 2) + (33 * 2.25) + 1 // 约 108 点（放大50%后）
  const headerRowHeight = (12 * 2) + (33 * 2.25) + 1 // 表头行高
  const totalTableHeight = headerRowHeight + (rowCount * baseRowHeight)
  
  // 强制条件：如果表格高度超过可用高度，必须计算缩放比例，确保在一页内
  if (totalTableHeight > AVAILABLE_HEIGHT) {
    const scaleFactor = AVAILABLE_HEIGHT / totalTableHeight
    // 最小缩放比例限制在0.4，确保即使数据很多也能在一页内显示（从0.6降低到0.4）
    // 如果数据太多，可以缩小到0.4，虽然字体会小一些，但能保证在一页内
    return Math.max(0.4, scaleFactor * 0.95) // 留5%余量，确保不会溢出
  }
  
  return 1.0 // 不需要缩放
}

/**
 * 创建动态样式，根据行数自动调整
 * 注意：返回普通对象而不是 StyleSheet，因为 StyleSheet.create 不能动态调用
 */
function createStyles(rowCount: number) {
  const scaleFactor = calculateScaleFactor(rowCount)
  
  // 基础字体大小（整体放大50%）
  const baseTitleFontSize = 16 * 1.5 // 24
  const baseHeaderLabelFontSize = 9 * 1.5 // 13.5
  const baseHeaderValueFontSize = 10 * 1.5 // 15
  const baseTableFontSize = 22 * 1.5 // 33，整体放大50%
  
  // 根据缩放比例调整，但确保最小字体不会太小
  // 注意：为了强制在一页内显示，当数据很多时，字体可能会缩小到最小值
  const titleFontSize = Math.max(14, baseTitleFontSize * scaleFactor) // 最小14点（从18降低，确保能在一页内）
  const headerLabelFontSize = Math.max(8, baseHeaderLabelFontSize * scaleFactor) // 最小8点（从10降低）
  const headerValueFontSize = Math.max(10, baseHeaderValueFontSize * scaleFactor) // 最小10点（从12降低）
  const tableFontSize = Math.max(16, baseTableFontSize * scaleFactor) // 最小16点（从21降低），确保即使数据很多也能在一页内
  const cellPadding = Math.max(4, 12 * scaleFactor) // 最小4点padding（从6降低）
  const lineHeight = Math.max(1.3, 2.25 * scaleFactor) // 最小1.3行高（从1.5降低）
  
  // 返回普通样式对象（不使用 StyleSheet.create，因为需要动态生成）
  return {
    page: {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      padding: PADDING,
      fontFamily: fontRegistered ? 'NotoSansSC' : 'Helvetica', // 如果字体未注册，使用默认字体
    },
    title: {
      fontSize: titleFontSize,
      fontWeight: 'bold',
      textAlign: 'center' as const,
      marginBottom: 12 * scaleFactor, // 从8增加到12，放大50%
    },
    headerSection: {
      marginBottom: 15 * scaleFactor, // 从10增加到15，放大50%
      display: 'flex' as const,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      flexWrap: 'nowrap' as const,
      alignItems: 'flex-start' as const,
    },
    headerItem: {
      flex: 1,
      marginRight: 12 * scaleFactor, // 从8增加到12，放大50%
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },
    headerLabel: {
      fontSize: headerLabelFontSize,
      color: '#666',
      marginBottom: 3 * scaleFactor, // 从2增加到3，放大50%
    },
    headerValue: {
      fontSize: headerValueFontSize,
      fontWeight: 'bold' as const,
      wordBreak: 'keep-all' as const,
      overflow: 'hidden' as const,
    },
    table: {
      marginTop: 7.5 * scaleFactor, // 从5增加到7.5，放大50%
      borderWidth: 1,
      borderColor: '#000',
    },
    tableHeader: {
      flexDirection: 'row' as const,
      backgroundColor: '#f0f0f0',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
    },
    tableHeaderCell: {
      padding: cellPadding,
      fontSize: tableFontSize,
      fontWeight: 'bold' as const,
      borderRightWidth: 1,
      borderRightColor: '#000',
      textAlign: 'center' as const,
      lineHeight: lineHeight,
      overflow: 'hidden' as const,
      wordBreak: 'keep-all' as const,
    },
    tableRow: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1,
      borderBottomColor: '#ccc',
    },
    tableCell: {
      padding: cellPadding,
      fontSize: tableFontSize,
      borderRightWidth: 1,
      borderRightColor: '#ccc',
      textAlign: 'center' as const,
      lineHeight: lineHeight,
      overflow: 'hidden' as const,
      wordBreak: 'keep-all' as const,
    },
    // 列宽定义（7列）- 调整仓点列更宽，确保所有内容都能显示
    col1: { width: '8%' },  // 性质：从10%减少到8%
    col2: { width: '18%' }, // 仓点：从12%增加到18%，确保所有内容都能显示
    col3: { width: '10%' }, // 数量：从12%减少到10%
    col4: { width: '16%' }, // 备注：保持16%
    col5: { width: '16%' }, // 实际板数：保持16%
    col6: { width: '16%' }, // 库位：保持16%
    col7: { width: '16%' }, // 备注：从18%减少到16%
  }
}

/**
 * 拆柜单据 PDF 文档
 */
export function UnloadSheetDocument({ data }: { data: UnloadSheetData }) {
  // 根据数据行数动态创建样式
  const rowCount = data.orderDetails.length
  console.log('[UnloadSheet PDF Component] 渲染文档:', {
    rowCount,
    containerNumber: data.containerNumber,
    fontRegistered,
    fontError: fontError ? { message: fontError.message } : null,
  })
  
  const styles = createStyles(rowCount)
  
  return (
    <Document>
      {/* 使用标准A4横向尺寸，强制只生成一页，不能分页 */}
      <Page 
        size="A4" 
        orientation="landscape" 
        style={styles.page}
        wrap={false} // 禁用自动换页，强制在一页内
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
                  // 如果性质是转仓，仓点后加*
                  if (detail.deliveryNature === '转仓') {
                    location += '*'
                  }
                  // 如果性质是扣货，仓点后加hold
                  else if (detail.deliveryNature === '扣货') {
                    location += 'hold'
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
