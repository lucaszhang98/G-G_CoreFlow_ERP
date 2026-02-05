/**
 * 装车单 PDF 组件（6 列布局）
 *
 * 全表 6 列：
 * - 第 1 行：第 1、2 列合并放 Logo；第 3 列「卸货仓」；第 4、5、6 列合并放目的地代码
 * - 第 2 行：Trailer | 空 | Load# | 预约号码(4+5+6 合并)
 * - 第 3 行：SEAL# | 空 | 预约时间 | 具体预约时间(4+5+6 合并)
 * - 第 4 行：柜号 | 仓储位置 | 计划板数 | 装车板数 | 剩余板数 | 是否清空
 * - 第 5 行起：明细（有几条生成几条）
 * - 最后一行：第 1、2 列合并「合计」| 总板数 | 空 | 空 | 地板/卡板
 */

import React from 'react'
import { Document, Page, Text, View, Font, Image } from '@react-pdf/renderer'
import { OAKLoadSheetData } from './types'
import { PageSizes } from './print-templates'
import path from 'path'
import fs from 'fs'

let fontRegistered = false
function registerFont() {
  const cwd = process.cwd()
  const fontPaths = [
    path.join(cwd, 'node_modules', '@fontsource', 'noto-sans-sc', 'files', 'noto-sans-sc-chinese-simplified-400-normal.woff'),
    path.join(cwd, 'public', 'fonts', 'NotoSansSC-Regular.woff'),
  ]
  for (const fontPath of fontPaths) {
    try {
      if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000) {
        Font.register({ family: 'NotoSansSC', src: fontPath })
        fontRegistered = true
        return
      }
    } catch (_) {}
  }
}
try { registerFont() } catch (_) {}

const PAGE_WIDTH = PageSizes.A4_PORTRAIT.width
const PAGE_HEIGHT = PageSizes.A4_PORTRAIT.height
const PADDING = 14
const FONT_FAMILY = fontRegistered ? 'NotoSansSC' : 'Helvetica'

const borderColor = '#000'
const borderWidth = 1
const cellPadding = 5
const minRowHeight = 22

// 6 列宽度（%）
const W1 = 20
const W2 = 20
const W3 = 15
const W4 = 15
const W5 = 15
const W6 = 15
const W1_2 = W1 + W2   // 第 1+2 列合并
const W4_5_6 = W4 + W5 + W6  // 第 4+5+6 列合并

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
}

/** 装车单 PDF 文档 */
export function LoadingSheetDocument({ data }: { data: OAKLoadSheetData }) {
  const {
    destinationLabel,
    destinationCode,
    loadNumber,
    appointmentTime,
    lines,
    totalPlannedPallets,
    totalIsClearLabel,
    logoPath,
  } = data

  let logoSrc: string | null = null
  if (logoPath) {
    const cwd = process.cwd()
    const fullPath = path.isAbsolute(logoPath) ? logoPath : path.join(cwd, logoPath)
    if (fs.existsSync(fullPath)) {
      try {
        logoSrc = 'file://' + fullPath
      } catch (_) {}
    }
  }
  const publicLogo = path.join(process.cwd(), 'public', 'loading-sheet', 'logo.png')
  const docsLogo = path.join(process.cwd(), 'docs', 'logo.png')
  if (!logoSrc && fs.existsSync(publicLogo)) {
    try {
      logoSrc = 'file://' + publicLogo
    } catch (_) {}
  }
  if (!logoSrc && fs.existsSync(docsLogo)) {
    try {
      logoSrc = 'file://' + docsLogo
    } catch (_) {}
  }

  const footerLabel = totalIsClearLabel !== undefined && totalIsClearLabel !== '' ? totalIsClearLabel : '地板'

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page} wrap={false}>
        <View style={styles.tableWrap}>
          {/* 第 1 行：第 1、2 列合并 Logo；第 3 列「卸货仓」；第 4、5、6 列合并 目的地代码 */}
          <View style={styles.tableRow}>
            <View style={[styles.logoCell, { width: `${W1_2}%` }]}>
              {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : <Text> </Text>}
            </View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}>
              <Text>{destinationLabel}</Text>
            </View>
            <View style={[styles.cell, { width: `${W4_5_6}%`, borderRightWidth: 0 }]}>
              <Text>{destinationCode}</Text>
            </View>
          </View>

          {/* 第 2 行：Trailer | 空 | Load# | 预约号码(4+5+6 合并) */}
          <View style={styles.tableRow}>
            <View style={[styles.headerCellLeft, { width: `${W1}%` }]}><Text>Trailer</Text></View>
            <View style={[styles.cell, { width: `${W2}%` }]}><Text></Text></View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}><Text>Load#</Text></View>
            <View style={[styles.cell, { width: `${W4_5_6}%`, borderRightWidth: 0 }]}>
              <Text>{loadNumber}</Text>
            </View>
          </View>

          {/* 第 3 行：SEAL# | 空 | 预约时间 | 具体预约时间(4+5+6 合并) */}
          <View style={styles.tableRow}>
            <View style={[styles.headerCellLeft, { width: `${W1}%` }]}><Text>SEAL#</Text></View>
            <View style={[styles.cell, { width: `${W2}%` }]}><Text></Text></View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}><Text>预约时间</Text></View>
            <View style={[styles.cell, { width: `${W4_5_6}%`, borderRightWidth: 0 }]}>
              <Text>{appointmentTime}</Text>
            </View>
          </View>

          {/* 第 4 行：表头 柜号 | 仓储位置 | 计划板数 | 装车板数 | 剩余板数 | 是否清空 */}
          <View style={styles.tableRow}>
            <View style={[styles.headerCell, { width: `${W1}%` }]}><Text>柜号</Text></View>
            <View style={[styles.headerCell, { width: `${W2}%` }]}><Text>仓储位置</Text></View>
            <View style={[styles.headerCell, { width: `${W3}%` }]}><Text>计划板数</Text></View>
            <View style={[styles.headerCell, { width: `${W4}%` }]}><Text>装车板数</Text></View>
            <View style={[styles.headerCell, { width: `${W5}%` }]}><Text>剩余板数</Text></View>
            <View style={[styles.headerCell, { width: `${W6}%`, borderRightWidth: 0 }]}><Text>是否清空</Text></View>
          </View>

          {/* 明细行：有几条生成几条 */}
          {lines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.cell, { width: `${W1}%` }]}>
                <Text>{line.container_number}</Text>
              </View>
              <View style={[styles.cell, { width: `${W2}%` }]}>
                <Text>{line.storage_location}</Text>
              </View>
              <View style={[styles.cell, { width: `${W3}%` }]}>
                <Text>{String(line.planned_pallets)}</Text>
              </View>
              <View style={[styles.cell, { width: `${W4}%` }]}>
                <Text>{line.loaded_pallets || ''}</Text>
              </View>
              <View style={[styles.cell, { width: `${W5}%` }]}>
                <Text>{line.remaining_pallets || ''}</Text>
              </View>
              <View style={[styles.checkboxCell, { width: `${W6}%`, borderRightWidth: 0 }]}>
                <View style={styles.checkbox} />
              </View>
            </View>
          ))}

          {/* 最后一行：第 1、2 列合并「合计」| 总板数 | 空 | 空 | 地板/卡板 */}
          <View style={[styles.tableRow, styles.totalRow]}>
            <View style={[styles.headerCell, { width: `${W1_2}%` }]}>
              <Text>合计</Text>
            </View>
            <View style={[styles.cell, { width: `${W3}%` }]}>
              <Text>{totalPlannedPallets}</Text>
            </View>
            <View style={[styles.cell, { width: `${W4}%` }]}><Text></Text></View>
            <View style={[styles.cell, { width: `${W5}%` }]}><Text></Text></View>
            <View style={[styles.cell, { width: `${W6}%`, borderRightWidth: 0 }]}>
              <Text>{footerLabel}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
