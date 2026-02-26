/**
 * 装车单 PDF 组件（7 列布局）
 *
 * 全表 7 列：
 * - 第 1 行：第 1、2 列合并放 Logo；第 3 列「卸货仓」；第 4、5、6、7 列合并放目的地代码
 * - 第 2 行：Trailer | 空 | Load# | 预约号码(5+6+7 合并)
 * - 第 3 行：SEAL# | 空（工人填写） | 预约时间 | 具体预约时间(5+6+7 合并)
 * - 第 4 行：柜号 | 仓储位置 | 计划板数 | 备注 | 装车板数 | 剩余板数 | 是否清空
 * - 第 5 行起：明细（有几条生成几条）
 * - 最后一行：第 1、2 列合并「合计」| 总板数 | 空 | 空 | 空 | 地板/卡板
 */

import React from 'react'
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import JsBarcode from 'jsbarcode'
import { createCanvas } from 'canvas'
import { OAKLoadSheetData } from './types'
import { PageSizes } from './print-templates'
import { pdfFontFamily } from './register-pdf-font'

const PAGE_WIDTH = PageSizes.A4_PORTRAIT.width
const PAGE_HEIGHT = PageSizes.A4_PORTRAIT.height
const PADDING = 14
const FONT_FAMILY = pdfFontFamily

const borderColor = '#000'
const borderWidth = 1
const cellPadding = 5
const minRowHeight = 22

// 7 列宽度（%）：柜号 | 仓储位置 | 计划板数 | 备注 | 装车板数 | 剩余板数 | 是否清空
const W1 = 20   // 柜号列加宽，避免显示不全
const W2 = 12
const W3 = 12   // 计划板数
const W4 = 18   // 备注
const W5 = 12
const W6 = 12
const W7 = 14
const W1_2 = W1 + W2
const W4_5_6_7 = W4 + W5 + W6 + W7  // 第 4+5+6+7 列合并（预约号码/预约时间）

const cellBase = {
  padding: cellPadding,
  borderColor,
  fontSize: 10,
  minHeight: minRowHeight,
  borderBottomWidth: borderWidth,
  borderRightWidth: borderWidth,
  fontFamily: FONT_FAMILY,
}
const cellCenter = { ...cellBase, textAlign: 'center' as const }
const cellLeft = { ...cellBase, textAlign: 'left' as const }
const cellBold = { ...cellBase, fontWeight: 'bold' as const, textAlign: 'center' as const }

const styles = {
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    padding: PADDING,
    fontFamily: FONT_FAMILY,
    fontSize: 10,
  },
  tableWrap: {
    borderWidth: borderWidth,
    borderColor,
  },
  tableRow: {
    flexDirection: 'row' as const,
  },
  cell: {
    ...cellCenter,
  },
  cellLeft: {
    ...cellLeft,
  },
  headerCell: {
    ...cellBase,
    backgroundColor: '#f0f0f0',
    textAlign: 'center' as const,
    fontWeight: 'bold' as const,
  },
  headerCellLeft: {
    ...cellBase,
    backgroundColor: '#f0f0f0',
    textAlign: 'left' as const,
    fontWeight: 'bold' as const,
  },
  logoCell: {
    ...cellBase,
    borderRightWidth: borderWidth,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: 'contain' as const,
  },
  totalRow: {
    flexDirection: 'row' as const,
    fontWeight: 'bold' as const,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor,
  },
  checkboxCell: {
    ...cellCenter,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  /** 柜号列：加粗加大，与其余列区分 */
  cellContainerNumber: {
    ...cellCenter,
    overflow: 'hidden' as const,
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  /** 备注列：可换行、缩小字体，避免溢出 */
  cellRemarks: {
    ...cellLeft,
    overflow: 'hidden' as const,
    fontSize: 8,
  },
  /** 第一行仓点单元格：仓点文字 + 下方条形码（预约号码） */
  destinationCell: {
    ...cellCenter,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-start' as const,
  },
  barcodeImage: {
    width: 120,
    height: 36,
    marginTop: 4,
    objectFit: 'contain' as const,
  },
}

/**
 * 生成条形码图片（Base64），内容为预约号码
 */
function generateBarcodeImage(barcodeText: string): string {
  try {
    const canvas = createCanvas(200, 60)
    JsBarcode(canvas, barcodeText, {
      format: 'CODE128',
      width: 2,
      height: 44,
      displayValue: false,
      margin: 4,
    })
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('[loading-sheet] 生成条形码失败:', error)
    return ''
  }
}

/** 装车单 PDF 文档 */
export function LoadingSheetDocument({ data }: { data: OAKLoadSheetData }) {
  const {
    destinationLabel,
    destinationCode,
    loadNumber,
    appointmentTime,
    delivery_address,
    lines,
    totalPlannedPallets,
    totalIsClearLabel,
    deliveryMethod,
    logoDataUrl,
  } = data

  const logoSrc = logoDataUrl || null
  const barcodeDataUrl = loadNumber ? generateBarcodeImage(loadNumber.replace(/\s+/g, '')) : null

  const typeLabel = totalIsClearLabel !== undefined && totalIsClearLabel !== '' ? totalIsClearLabel : '地板'
  const footerLabel = deliveryMethod ? `${typeLabel} ${deliveryMethod}` : typeLabel

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page} wrap={false}>
        <View style={styles.tableWrap}>
          {/* 第 1 行：第 1、2 列合并 Logo；第 3 列「卸货仓」；第 4、5、6 列合并 仓点 + 下方条形码（预约号码） */}
          <View style={styles.tableRow}>
            <View style={[styles.logoCell, { width: `${W1_2}%` }]}>
              {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : <Text> </Text>}
            </View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}>
              <Text>{destinationLabel}</Text>
            </View>
            <View style={[styles.destinationCell, { width: `${W4_5_6_7}%`, borderRightWidth: 0 }]}>
              <Text>{destinationCode}</Text>
              {barcodeDataUrl ? <Image src={barcodeDataUrl} style={styles.barcodeImage} /> : null}
            </View>
          </View>

          {/* 第 2 行：Trailer | 空 | Load# | 预约号码(5+6+7 合并) */}
          <View style={styles.tableRow}>
            <View style={[styles.headerCellLeft, { width: `${W1}%` }]}><Text>Trailer</Text></View>
            <View style={[styles.cell, { width: `${W2}%` }]}><Text></Text></View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}><Text>Load#</Text></View>
            <View style={[styles.cell, { width: `${W4_5_6_7}%`, borderRightWidth: 0 }]}>
              <Text>{loadNumber}</Text>
            </View>
          </View>

          {/* 第 3 行：SEAL# | 空（工人填写） | 预约时间 | 具体预约时间(5+6+7 合并) */}
          <View style={styles.tableRow}>
            <View style={[styles.headerCellLeft, { width: `${W1}%` }]}><Text>SEAL#</Text></View>
            <View style={[styles.cell, { width: `${W2}%` }]}><Text></Text></View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}><Text>预约时间</Text></View>
            <View style={[styles.cell, { width: `${W4_5_6_7}%`, borderRightWidth: 0 }]}>
              <Text>{appointmentTime}</Text>
            </View>
          </View>

          {/* 第 4 行：表头 柜号 | 仓储位置 | 计划板数 | 备注 | 装车板数 | 剩余板数 | 是否清空 */}
          <View style={styles.tableRow}>
            <View style={[styles.headerCell, { width: `${W1}%` }]}><Text>柜号</Text></View>
            <View style={[styles.headerCell, { width: `${W2}%` }]}><Text>仓储位置</Text></View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}><Text>计划板数</Text></View>
            <View style={[styles.headerCell, { width: `${W4}%` }]}><Text>备注</Text></View>
            <View style={[styles.headerCell, { width: `${W5}%` }]}><Text>装车板数</Text></View>
            <View style={[styles.headerCell, { width: `${W6}%` }]}><Text>剩余板数</Text></View>
            <View style={[styles.headerCell, { width: `${W7}%`, borderRightWidth: 0 }]}><Text>是否清空</Text></View>
          </View>

          {/* 明细行：柜号加粗加大；第3列计划板数、第4列备注 */}
          {lines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.cellContainerNumber, { width: `${W1}%` }]}>
                <Text wrap>{line.container_number}</Text>
              </View>
              <View style={[styles.cell, { width: `${W2}%` }]}>
                <Text wrap>{line.storage_location}</Text>
              </View>
              <View style={[styles.cell, { width: `${W3}%` }]}>
                <Text>{String(line.planned_pallets)}</Text>
              </View>
              <View style={[styles.cellRemarks, { width: `${W4}%` }]}>
                <Text wrap>{(line.load_sheet_notes ?? '').toString()}</Text>
              </View>
              <View style={[styles.cell, { width: `${W5}%` }]}>
                <Text>{line.loaded_pallets || ''}</Text>
              </View>
              <View style={[styles.cell, { width: `${W6}%` }]}>
                <Text>{line.remaining_pallets || ''}</Text>
              </View>
              <View style={[styles.checkboxCell, { width: `${W7}%`, borderRightWidth: 0 }]}>
                <View style={styles.checkbox} />
              </View>
            </View>
          ))}

          {/* 最后一行：第 1、2 列合并「合计」| 空 | 总板数(计划板数列) | 空 | 空 | 地板/卡板 */}
          <View style={[styles.tableRow, styles.totalRow]}>
            <View style={[styles.headerCell, { width: `${W1_2}%` }]}>
              <Text>合计</Text>
            </View>
            <View style={[styles.cell, { width: `${W3}%` }]}>
              <Text>{totalPlannedPallets}</Text>
            </View>
            <View style={[styles.cell, { width: `${W4}%` }]}><Text></Text></View>
            <View style={[styles.cell, { width: `${W5}%` }]}><Text></Text></View>
            <View style={[styles.cell, { width: `${W6}%` }]}><Text></Text></View>
            <View style={[styles.cell, { width: `${W7}%`, borderRightWidth: 0 }]}>
              <Text>{footerLabel}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
