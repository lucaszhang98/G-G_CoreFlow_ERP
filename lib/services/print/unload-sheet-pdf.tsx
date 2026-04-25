/**
 * 拆柜单据 PDF 组件（使用 @react-pdf/renderer）
 *
 * A4 横排：备注多时提高第 4/7 列 flex 权重；列用 flexGrow 填满表宽，避免百分比+边框导致最右列被挤没。
 */

import React from 'react'
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { UnloadSheetData } from './types'
import { formatDate } from './print-templates'
import { pdfFontRegistered, pdfFontFamily } from './register-pdf-font'
import JsBarcode from 'jsbarcode'
import { createCanvas } from 'canvas'

const PAGE_PT_WIDTH = 841.89
const PAGE_PT_HEIGHT = 595.28
const PADDING = 12
const INNER_WIDTH_PT = PAGE_PT_WIDTH - PADDING * 2
const USABLE_HEIGHT_PT = PAGE_PT_HEIGHT - PADDING * 2
const HEIGHT_SAFETY = 1.22

const BASE_TITLE_FONT_SIZE = 32 * 1.5

function getTitleFontSize(scale: number): number {
  return Math.max(24, BASE_TITLE_FONT_SIZE * scale)
}

/**
 * 拆柜单 PDF 条形码占位（@react-pdf 中 pt）：产品约定尺寸，固定不变（当前 200×36）。
 * 不参与表格 findOptimalScale、不与标题字号联动；勿改比例或改为按版心百分比。
 */
const UNLOAD_SHEET_BARCODE_WIDTH_PT = 200
const UNLOAD_SHEET_BARCODE_HEIGHT_PT = 36

/** 条形码区垂直占用（与样式 margin 一致，供分页估算） */
function getUnloadSheetBarcodeBlockHeightPt(scale: number): number {
  const topGap = 4
  const bottomGap = Math.max(10, 10 * scale)
  return topGap + UNLOAD_SHEET_BARCODE_HEIGHT_PT + bottomGap
}

type OrderDetailRow = UnloadSheetData['orderDetails'][number]

/** 七列 flex 权重（仅比例有意义，总和任意正数） */
type ColFlexWeights = {
  w1: number
  w2: number
  w3: number
  w4: number
  w5: number
  w6: number
  w7: number
}

function sumWeights(c: ColFlexWeights): number {
  return c.w1 + c.w2 + c.w3 + c.w4 + c.w5 + c.w6 + c.w7
}

function fractionOfInner(c: ColFlexWeights, wi: number): number {
  const s = sumWeights(c)
  return s > 0 ? wi / s : 1 / 7
}

/**
 * 备注越长，第 4、7 列 flex 越大（从数量/板数/库位借比例）。
 */
function computeColFlexWeights(data: UnloadSheetData): ColFlexWeights {
  let maxNoteLen = 0
  let totalNoteChars = 0
  for (const d of data.orderDetails) {
    const a = (d.notes ?? '').length
    const b = (d.workerNotes ?? '').length
    maxNoteLen = Math.max(maxNoteLen, a, b)
    totalNoteChars += a + b
  }
  if (data.orderNotes) {
    totalNoteChars += data.orderNotes.length
    maxNoteLen = Math.max(maxNoteLen, data.orderNotes.length)
  }

  if (maxNoteLen > 90 || totalNoteChars > 480) {
    return { w1: 5, w2: 13, w3: 7, w4: 28, w5: 10, w6: 10, w7: 28 }
  }
  if (maxNoteLen > 42 || totalNoteChars > 180) {
    return { w1: 6, w2: 15, w3: 8, w4: 23, w5: 12, w6: 12, w7: 24 }
  }
  return { w1: 7, w2: 17, w3: 9, w4: 18, w5: 14, w6: 14, w7: 21 }
}

function buildLocationDisplay(detail: OrderDetailRow): string {
  let location = detail.deliveryLocation || '-'
  if (detail.deliveryNature === '转仓') location += '+'
  else if (detail.deliveryNature === '扣货') location += '-hold'
  return location
}

function estimateWrappedLines(
  text: string | null | undefined,
  colFractionOfInner: number,
  fontSize: number,
  padLeft: number,
  padRight: number = padLeft
): number {
  const raw = (text ?? '').trim()
  const t = raw.length === 0 ? '-' : raw
  const colOuter = INNER_WIDTH_PT * colFractionOfInner
  const colW = Math.max(fontSize * 2, colOuter - padLeft - padRight)
  if (colW <= 0 || fontSize <= 0) return 1
  const charW = fontSize * 1.18
  const charsPerLine = Math.max(2, Math.floor(colW / charW))
  let lines = 0
  for (const segment of t.split(/\n/)) {
    const seg = segment.length === 0 ? ' ' : segment
    lines += Math.max(1, Math.ceil(seg.length / charsPerLine))
  }
  return Math.max(1, Math.ceil(lines * 1.08))
}

function estimateRowMaxLines(
  detail: OrderDetailRow,
  tableFontSize: number,
  cols: ColFlexWeights,
  cellPaddingPt: number,
  /** 与 createStyles：备注列 paddingLeft = cellPadding + noteL */
  noteL: number,
  /** 备注列在左侧额外留白基础上，右侧再多留的宽度（pt） */
  noteRBoost: number,
  /** 第 7 列贴表格外框，再追加的右侧留白（pt） */
  noteCol7Edge: number
): number {
  const loc = buildLocationDisplay(detail)
  const plN = cellPaddingPt + noteL
  const prN4 = cellPaddingPt + noteL + noteRBoost
  const prN7 = cellPaddingPt + noteL + noteRBoost + noteCol7Edge
  return Math.max(
    estimateWrappedLines(detail.deliveryNature || '-', fractionOfInner(cols, cols.w1), tableFontSize, cellPaddingPt),
    estimateWrappedLines(loc, fractionOfInner(cols, cols.w2), tableFontSize, cellPaddingPt),
    estimateWrappedLines(
      detail.quantity !== undefined ? String(detail.quantity) : '-',
      fractionOfInner(cols, cols.w3),
      tableFontSize,
      cellPaddingPt
    ),
    estimateWrappedLines(detail.notes, fractionOfInner(cols, cols.w4), tableFontSize, plN, prN4),
    estimateWrappedLines(
      detail.actualPallets !== undefined ? String(detail.actualPallets) : '',
      fractionOfInner(cols, cols.w5),
      tableFontSize,
      cellPaddingPt
    ),
    estimateWrappedLines(detail.storageLocation, fractionOfInner(cols, cols.w6), tableFontSize, cellPaddingPt),
    estimateWrappedLines(detail.workerNotes, fractionOfInner(cols, cols.w7), tableFontSize, plN, prN7)
  )
}

function metricsForScale(scale: number, data: UnloadSheetData, cols: ColFlexWeights) {
  const baseHeaderLabelFontSize = 9 * 1.5
  const baseHeaderValueFontSize = 10 * 1.5
  const baseTableFontSize = 22 * 1.5

  const titleFontSize = getTitleFontSize(scale)
  const headerLabelFontSize = Math.max(8, baseHeaderLabelFontSize * scale)
  const headerValueFontSize = Math.max(10, baseHeaderValueFontSize * scale)
  const tableFontSize = Math.max(16, baseTableFontSize * scale)
  const cellPadding = Math.max(4, 12 * scale)
  /** 备注列左侧在 cellPadding 上追加的留白（pt） */
  const noteL = Math.max(6, 8 * scale)
  /** 备注列右侧在「与左侧对称部分」之上再追加，左对齐时视觉才均衡 */
  const noteRBoost = Math.max(10, 13 * scale)
  /** 第 7 列靠表格外框，右侧再多留一点 */
  const noteCol7Edge = Math.max(5, 7 * scale)
  const lineHeight = Math.max(1.3, 2.25 * scale)

  const rowTextHeight = (lines: number) => cellPadding * 2 + tableFontSize * lineHeight * lines

  let y = 0
  y += titleFontSize * 1.2 + 12 * scale
  y += getUnloadSheetBarcodeBlockHeightPt(scale)
  y += headerValueFontSize * 2.2 + 15 * scale

  if (data.orderNotes != null && data.orderNotes !== '') {
    const onFs = Math.max(7, baseHeaderValueFontSize * 0.9 * scale)
    const orderPadL = Math.max(8, 10 * scale)
    const orderPadR = Math.max(14, 18 * scale)
    const onLines = estimateWrappedLines(data.orderNotes, 1, onFs, orderPadL, orderPadR)
    y += 8 * scale + onFs * 1.4 * onLines + 6 * scale + 4 * scale
  }

  y += 7.5 * scale
  y += rowTextHeight(1)

  for (const d of data.orderDetails) {
    const lines = estimateRowMaxLines(d, tableFontSize, cols, cellPadding, noteL, noteRBoost, noteCol7Edge)
    y += rowTextHeight(lines)
  }

  y += 18

  return { y, titleFontSize, headerLabelFontSize, headerValueFontSize, tableFontSize, cellPadding, lineHeight }
}

function findOptimalScale(data: UnloadSheetData, cols: ColFlexWeights): number {
  const rowCount = data.orderDetails.length
  if (rowCount === 0) return 1

  const minScale = 0.16
  let lo = minScale
  let hi = 1.0
  let best = minScale
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2
    const { y } = metricsForScale(mid, data, cols)
    if (y * HEIGHT_SAFETY <= USABLE_HEIGHT_PT) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
  }
  let { y: yBest } = metricsForScale(best, data, cols)
  if (yBest * HEIGHT_SAFETY > USABLE_HEIGHT_PT && yBest > 0) {
    best = Math.max(minScale, best * (USABLE_HEIGHT_PT / (yBest * HEIGHT_SAFETY)) * 0.94)
    ;({ y: yBest } = metricsForScale(best, data, cols))
    if (yBest * HEIGHT_SAFETY > USABLE_HEIGHT_PT && yBest > 0) {
      best = Math.max(0.12, best * (USABLE_HEIGHT_PT / (yBest * HEIGHT_SAFETY)) * 0.94)
    }
  }
  best *= 0.97
  return Math.max(minScale, best)
}

/** 备注列：左侧 +noteL，右侧 +noteL+noteRBoost（可再叠 col7 贴边补偿） */
type NotesCellPad = { leftExtra: number; rightExtra: number }

function tableCellBase(cellPadding: number, flexGrow: number, notesPad?: NotesCellPad) {
  const common = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
    justifyContent: 'flex-start' as const,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
    alignSelf: 'stretch' as const,
    flexGrow,
    flexBasis: 0 as const,
    flexShrink: 1,
    minWidth: 0 as const,
  }
  if (!notesPad) {
    return { ...common, padding: cellPadding }
  }
  return {
    ...common,
    paddingTop: cellPadding,
    paddingBottom: cellPadding,
    paddingLeft: cellPadding + notesPad.leftExtra,
    paddingRight: cellPadding + notesPad.rightExtra,
  }
}

function tableHeaderCellBase(cellPadding: number, flexGrow: number, notesPad?: NotesCellPad) {
  const common = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
    justifyContent: 'center' as const,
    borderRightWidth: 1,
    borderRightColor: '#000',
    backgroundColor: '#f0f0f0',
    alignSelf: 'stretch' as const,
    flexGrow,
    flexBasis: 0 as const,
    flexShrink: 1,
    minWidth: 0 as const,
  }
  if (!notesPad) {
    return { ...common, padding: cellPadding }
  }
  return {
    ...common,
    paddingTop: cellPadding,
    paddingBottom: cellPadding,
    paddingLeft: cellPadding + notesPad.leftExtra,
    paddingRight: cellPadding + notesPad.rightExtra,
  }
}

function createStyles(scaleFactor: number, cols: ColFlexWeights) {
  const baseHeaderLabelFontSize = 9 * 1.5
  const baseHeaderValueFontSize = 10 * 1.5
  const baseTableFontSize = 22 * 1.5
  const s = scaleFactor

  const titleFontSize = getTitleFontSize(s)
  const headerLabelFontSize = Math.max(8, baseHeaderLabelFontSize * s)
  const headerValueFontSize = Math.max(10, baseHeaderValueFontSize * s)
  const tableFontSize = Math.max(16, baseTableFontSize * s)
  const cellPadding = Math.max(4, 12 * s)
  const noteL = Math.max(6, 8 * s)
  const noteRBoost = Math.max(10, 13 * s)
  const noteCol7Edge = Math.max(5, 7 * s)
  const padNotes4: NotesCellPad = { leftExtra: noteL, rightExtra: noteL + noteRBoost }
  const padNotes7: NotesCellPad = { leftExtra: noteL, rightExtra: noteL + noteRBoost + noteCol7Edge }
  const lineHeight = Math.max(1.3, 2.25 * s)

  return {
    page: {
      width: PAGE_PT_WIDTH,
      height: PAGE_PT_HEIGHT,
      padding: PADDING,
      fontFamily: pdfFontFamily,
    },
    /** 占满版心高度，用 flex 垂直居中整块单据（短内容时上下留白对称） */
    pageBody: {
      width: '100%',
      minHeight: USABLE_HEIGHT_PT,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },
    contentWrap: {
      width: '100%',
    },
    orderNotesSection: {
      marginBottom: 8 * s,
      paddingBottom: 6 * s,
      paddingLeft: Math.max(8, 10 * s),
      paddingRight: Math.max(14, 18 * s),
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
    },
    orderNotesLabel: {
      fontSize: Math.max(8, baseHeaderLabelFontSize * s),
      color: '#666',
      marginBottom: 2 * s,
    },
    orderNotesText: {
      fontSize: Math.max(7, baseHeaderValueFontSize * 0.9 * s),
      lineHeight: 1.4,
      wordBreak: 'break-all' as const,
      textAlign: 'left' as const,
      width: '100%',
      maxWidth: '100%',
    },
    title: {
      fontSize: titleFontSize,
      fontWeight: 'bold',
      textAlign: 'center' as const,
      marginBottom: 12 * s,
      letterSpacing: 2,
    },
    barcodeBlock: {
      alignItems: 'center' as const,
      marginTop: 4,
      marginBottom: Math.max(10, 10 * s),
    },
    barcodeImage: {
      width: UNLOAD_SHEET_BARCODE_WIDTH_PT,
      height: UNLOAD_SHEET_BARCODE_HEIGHT_PT,
    },
    headerSection: {
      marginBottom: 15 * s,
      display: 'flex' as const,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      flexWrap: 'nowrap' as const,
      alignItems: 'flex-start' as const,
    },
    headerItem: {
      flex: 1,
      marginRight: 12 * s,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },
    headerLabel: {
      fontSize: headerLabelFontSize,
      color: '#666',
      marginBottom: 3 * s,
    },
    headerValue: {
      fontSize: headerValueFontSize,
      fontWeight: 'bold' as const,
      wordBreak: 'break-word' as const,
    },
    table: {
      marginTop: 7.5 * s,
      borderWidth: 1,
      borderColor: '#000',
      width: '100%',
    },
    tableHeader: {
      flexDirection: 'row' as const,
      alignItems: 'stretch' as const,
      backgroundColor: '#f0f0f0',
      borderBottomWidth: 1,
      borderBottomColor: '#000',
      width: '100%',
    },
    tableRow: {
      flexDirection: 'row' as const,
      alignItems: 'stretch' as const,
      borderBottomWidth: 1,
      borderBottomColor: '#ccc',
      width: '100%',
    },
    /** 限制在列宽内换行 */
    cellInner: {
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      alignSelf: 'stretch' as const,
    },
    tableHeaderText: {
      fontSize: tableFontSize,
      fontWeight: 'bold' as const,
      lineHeight,
      wordBreak: 'break-all' as const,
      textAlign: 'center' as const,
      width: '100%',
      maxWidth: '100%',
    },
    tableCellText: {
      fontSize: tableFontSize,
      lineHeight,
      wordBreak: 'break-all' as const,
      textAlign: 'center' as const,
      width: '100%',
      maxWidth: '100%',
    },
    tableCellNotesText: {
      fontSize: tableFontSize,
      lineHeight,
      wordBreak: 'break-all' as const,
      textAlign: 'left' as const,
      width: '100%',
      maxWidth: '100%',
    },
    th1: tableHeaderCellBase(cellPadding, cols.w1),
    th2: tableHeaderCellBase(cellPadding, cols.w2),
    th3: tableHeaderCellBase(cellPadding, cols.w3),
    th4: tableHeaderCellBase(cellPadding, cols.w4, padNotes4),
    th5: tableHeaderCellBase(cellPadding, cols.w5),
    th6: tableHeaderCellBase(cellPadding, cols.w6),
    th7: { ...tableHeaderCellBase(cellPadding, cols.w7, padNotes7), borderRightWidth: 0 },
    td1: tableCellBase(cellPadding, cols.w1),
    td2: tableCellBase(cellPadding, cols.w2),
    td3: tableCellBase(cellPadding, cols.w3),
    td4: tableCellBase(cellPadding, cols.w4, padNotes4),
    td5: tableCellBase(cellPadding, cols.w5),
    td6: tableCellBase(cellPadding, cols.w6),
    td7: { ...tableCellBase(cellPadding, cols.w7, padNotes7), borderRightWidth: 0 },
  }
}

function generateBarcodeImage(barcodeText: string, widthPt: number, heightPt: number): string {
  try {
    const pr = 2.2
    const w = Math.max(360, Math.round(widthPt * pr))
    const h = Math.max(100, Math.round(heightPt * pr))
    const canvas = createCanvas(w, h)
    const margin = 8
    const barHeight = Math.round(h * 0.78)
    const moduleCap = Math.max(2, Math.floor((w - margin * 2) / Math.max(20, barcodeText.length * 11 + 6)))
    const moduleW = Math.min(4, moduleCap)
    JsBarcode(canvas, barcodeText, {
      format: 'CODE128',
      width: moduleW,
      height: barHeight,
      displayValue: false,
      margin,
    })
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('生成条形码失败:', error)
    return ''
  }
}

export function UnloadSheetDocument({ data }: { data: UnloadSheetData }) {
  const cols = computeColFlexWeights(data)
  const scale = findOptimalScale(data, cols)
  const styles = createStyles(scale, cols)
  const { y: contentHeightPt } = metricsForScale(scale, data, cols)
  /** 估算内容明显短于版心时用 flex 居中；阈值避免临界抖动 */
  const shouldVerticallyCenter = contentHeightPt + 4 < USABLE_HEIGHT_PT
  const containerNumber = data.containerNumber || ''
  const barcodeImage = containerNumber
    ? generateBarcodeImage(
        containerNumber.replace(/\s+/g, ''),
        UNLOAD_SHEET_BARCODE_WIDTH_PT,
        UNLOAD_SHEET_BARCODE_HEIGHT_PT
      )
    : null

  console.log('[UnloadSheet PDF Component] 渲染文档:', {
    rowCount: data.orderDetails.length,
    containerNumber: data.containerNumber,
    fontRegistered: pdfFontRegistered,
    scale,
    colFlex: cols,
  })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View
          style={[
            styles.pageBody,
            shouldVerticallyCenter ? { justifyContent: 'center' as const } : { justifyContent: 'flex-start' as const },
          ]}
        >
          <View style={styles.contentWrap}>
          <Text style={styles.title}>{containerNumber || '-'}</Text>

          <View style={styles.barcodeBlock}>
            {barcodeImage ? <Image src={barcodeImage} style={styles.barcodeImage} /> : null}
          </View>

          <View style={styles.headerSection}>
            <View style={styles.headerItem}>
              <Text style={styles.headerLabel}>客户代码：</Text>
              <Text style={styles.headerValue}>{data.customerCode || '-'}</Text>
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

          {data.orderNotes != null && data.orderNotes !== '' && (
            <View style={styles.orderNotesSection}>
              <Text style={styles.orderNotesLabel}>备注：</Text>
              <Text style={styles.orderNotesText} wrap>
                {data.orderNotes}
              </Text>
            </View>
          )}

          <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.th1}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  性质
                </Text>
              </View>
            </View>
            <View style={styles.th2}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  仓点
                </Text>
              </View>
            </View>
            <View style={styles.th3}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  数量
                </Text>
              </View>
            </View>
            <View style={styles.th4}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  备注
                </Text>
              </View>
            </View>
            <View style={styles.th5}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  实际板数
                </Text>
              </View>
            </View>
            <View style={styles.th6}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  库位
                </Text>
              </View>
            </View>
            <View style={styles.th7}>
              <View style={styles.cellInner}>
                <Text style={styles.tableHeaderText} wrap>
                  备注
                </Text>
              </View>
            </View>
          </View>

            {data.orderDetails.map((detail, index) => (
              <View key={index} style={styles.tableRow}>
              <View style={styles.td1}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellText} wrap>
                    {detail.deliveryNature || '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.td2}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellText} wrap>
                    {buildLocationDisplay(detail)}
                  </Text>
                </View>
              </View>
              <View style={styles.td3}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellText} wrap>
                    {detail.quantity !== undefined ? detail.quantity.toString() : '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.td4}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellNotesText} wrap>
                    {detail.notes || '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.td5}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellText} wrap>
                    {detail.actualPallets !== undefined ? detail.actualPallets.toString() : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.td6}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellText} wrap>
                    {detail.storageLocation || ''}
                  </Text>
                </View>
              </View>
              <View style={styles.td7}>
                <View style={styles.cellInner}>
                  <Text style={styles.tableCellNotesText} wrap>
                    {detail.workerNotes || ''}
                  </Text>
                </View>
              </View>
              </View>
            ))}
          </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
