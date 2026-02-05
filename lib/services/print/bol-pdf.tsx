/**
 * BOL (Bill of Lading) PDF 组件
 * 版式与 docs/135928027988 SCK8 BOL.pdf 样本一致（不生成二维码）
 */

import React from 'react'
import { Document, Page, Text, View, Font, Image } from '@react-pdf/renderer'
import { OAKBOLData } from './types'
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
const cellPadding = 4
const minRowHeight = 20

const cellBase = {
  padding: cellPadding,
  borderColor,
  fontSize: 9,
  minHeight: minRowHeight,
  borderBottomWidth: borderWidth,
  borderRightWidth: borderWidth,
  fontFamily: FONT_FAMILY,
}
const cellCenter = { ...cellBase, textAlign: 'center' as const }
const cellLeft = { ...cellBase, textAlign: 'left' as const }
const cellBold = { ...cellBase, fontWeight: 'bold' as const, textAlign: 'center' as const }
const cellBoldLeft = { ...cellBase, fontWeight: 'bold' as const, textAlign: 'left' as const }

const styles = {
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    padding: PADDING,
    fontFamily: FONT_FAMILY,
    fontSize: 9,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  printTimeBlock: {
    flexDirection: 'column' as const,
  },
  printTimeLabel: {
    fontSize: 9,
    fontFamily: FONT_FAMILY,
    marginBottom: 2,
  },
  printTimeValue: {
    fontSize: 9,
    fontFamily: FONT_FAMILY,
  },
  logoBlock: {
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 32,
    marginRight: 6,
    objectFit: 'contain' as const,
  },
  companyName: {
    fontSize: 10,
    fontWeight: 'bold' as const,
    fontFamily: FONT_FAMILY,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
    fontFamily: FONT_FAMILY,
  },
  shipTable: {
    borderWidth: borderWidth,
    borderColor,
    marginBottom: 0,
  },
  shipRow: {
    flexDirection: 'row' as const,
  },
  shipFromHeader: {
    ...cellBold,
    width: '50%',
    backgroundColor: '#f5f5f5',
  },
  shipToHeader: {
    ...cellBold,
    width: '50%',
    borderLeftWidth: borderWidth,
    backgroundColor: '#f5f5f5',
  },
  shipFromCell: {
    ...cellLeft,
    width: '50%',
  },
  shipToCell: {
    ...cellLeft,
    width: '50%',
    borderLeftWidth: borderWidth,
  },
  infoRow4: {
    flexDirection: 'row' as const,
  },
  info4Label: {
    ...cellBoldLeft,
    width: '25%',
    backgroundColor: '#f5f5f5',
  },
  info4Value: {
    ...cellLeft,
    width: '25%',
    borderLeftWidth: 0,
    marginLeft: -1,
  },
  detailTable: {
    borderWidth: borderWidth,
    borderColor,
    marginTop: 0,
  },
  tableRow: {
    flexDirection: 'row' as const,
  },
  headerCell: {
    ...cellBold,
    backgroundColor: '#f0f0f0',
  },
  dataCell: {
    ...cellLeft,
  },
  dataCellCenter: {
    ...cellCenter,
  },
  colContainer: { width: '18%' },
  colFba: { width: '18%' },
  colQty: { width: '12%' },
  colBox: { width: '12%' },
  colStorage: { width: '20%' },
  colPo: { width: '20%' },
  disclaimer: {
    marginTop: 10,
    padding: 8,
    borderWidth: borderWidth,
    borderColor,
    fontSize: 8,
    fontFamily: FONT_FAMILY,
    lineHeight: 1.4,
  },
  signatureRow: {
    flexDirection: 'row' as const,
    marginTop: 8,
    borderBottomWidth: borderWidth,
    borderColor,
    paddingBottom: 2,
    alignItems: 'flex-end',
  },
  signatureLabel: {
    fontSize: 9,
    fontWeight: 'bold' as const,
    fontFamily: FONT_FAMILY,
    marginRight: 8,
  },
  signatureLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#999',
    marginRight: 16,
    minHeight: 14,
  },
  dateBlock: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    width: 120,
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: 'bold' as const,
    fontFamily: FONT_FAMILY,
    marginRight: 4,
  },
}

const DISCLAIMER_EN = 'Delivered to a private warehouse: please receiver count the number of goods on the spot and sign, If there is a shortage of goods and abnormal conditions, Please indicate on BOL. If the feedback is abnormal after, we will take the POD signed quantity as the standard.'
const DISCLAIMER_CN = '派送私人仓货物:请收货仓库当场清点货物件数并签字,如有少货异常请再签收单上注明,事后再反馈我司一律以签收单上的数量为准.'

/** BOL PDF 文档（与样本一致，不生成二维码） */
export function BOLDocument({ data }: { data: OAKBOLData }) {
  const {
    printTime,
    shipFrom,
    shipTo,
    appointmentId,
    appointmentTime,
    seal,
    container,
    lines,
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

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page} wrap={false}>
        {/* 顶部：左侧 打印时间，右侧 Logo + 公司名（不生成二维码） */}
        <View style={styles.headerRow}>
          <View style={styles.printTimeBlock}>
            <Text style={styles.printTimeLabel}>打印时间</Text>
            <Text style={styles.printTimeValue}>{printTime}</Text>
          </View>
          <View style={styles.logoBlock}>
            {logoSrc && <Image src={logoSrc} style={styles.logo} />}
            <Text style={styles.companyName}>G&G Transport Inc</Text>
          </View>
        </View>

        <Text style={styles.title}>BILL OF LADING</Text>

        {/* Ship from / Ship to 表格 */}
        <View style={styles.shipTable}>
          <View style={styles.shipRow}>
            <View style={[styles.shipFromHeader]}><Text>Ship from</Text></View>
            <View style={[styles.shipToHeader, { borderRightWidth: 0 }]}><Text>Ship to</Text></View>
          </View>
          <View style={styles.shipRow}>
            <View style={[styles.shipFromCell]}><Text>{shipFrom.companyName}</Text></View>
            <View style={[styles.shipToCell, { borderRightWidth: 0 }]}><Text>{shipTo.destinationCode}</Text></View>
          </View>
          <View style={styles.shipRow}>
            <View style={[styles.shipFromCell]}><Text>{shipFrom.address}</Text></View>
            <View style={[styles.shipToCell, { borderRightWidth: 0 }]}><Text>{shipTo.address}</Text></View>
          </View>
          <View style={styles.shipRow}>
            <View style={[styles.shipFromCell]}><Text>ATTN: {shipFrom.attn}</Text></View>
            <View style={[styles.shipToCell, { borderRightWidth: 0 }]}><Text>ATTN: {shipTo.attn}</Text></View>
          </View>
          <View style={styles.shipRow}>
            <View style={[styles.shipFromCell]}><Text>Phone: {shipFrom.phone}</Text></View>
            <View style={[styles.shipToCell, { borderRightWidth: 0 }]}><Text>{shipTo.phone ? `Phone: ${shipTo.phone}` : 'Phone:'}</Text></View>
          </View>
        </View>

        {/* Appointment ID | 值 | Appointment time | 值 */}
        <View style={[styles.shipTable, { marginTop: 0 }]}>
          <View style={styles.infoRow4}>
            <View style={[styles.info4Label, { width: '25%' }]}><Text>Appointment ID</Text></View>
            <View style={[styles.info4Value, { width: '25%' }]}><Text>{appointmentId}</Text></View>
            <View style={[styles.info4Label, { width: '25%', borderLeftWidth: borderWidth }]}><Text>Appointment time</Text></View>
            <View style={[styles.info4Value, { width: '25%', borderRightWidth: 0 }]}><Text>{appointmentTime}</Text></View>
          </View>
          <View style={styles.infoRow4}>
            <View style={[styles.info4Label, { width: '25%' }]}><Text>SEAL</Text></View>
            <View style={[styles.info4Value, { width: '25%' }]}><Text>{seal}</Text></View>
            <View style={[styles.info4Label, { width: '25%', borderLeftWidth: borderWidth }]}><Text>Container</Text></View>
            <View style={[styles.info4Value, { width: '25%', borderRightWidth: 0 }]}><Text>{container}</Text></View>
          </View>
        </View>

        {/* 明细表：Container | FBA ID | Qty (PLTS) | Box | Storage | PO ID */}
        <View style={styles.detailTable}>
          <View style={styles.tableRow}>
            <View style={[styles.headerCell, styles.colContainer]}><Text>Container</Text></View>
            <View style={[styles.headerCell, styles.colFba]}><Text>FBA ID</Text></View>
            <View style={[styles.headerCell, styles.colQty]}><Text>Qty (PLTS)</Text></View>
            <View style={[styles.headerCell, styles.colBox]}><Text>Box</Text></View>
            <View style={[styles.headerCell, styles.colStorage]}><Text>Storage</Text></View>
            <View style={[styles.headerCell, styles.colPo, { borderRightWidth: 0 }]}><Text>PO ID</Text></View>
          </View>
          {lines.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.dataCell, styles.colContainer]}>
                <Text>{line.container_number}</Text>
              </View>
              <View style={[styles.dataCell, styles.colFba]}>
                <Text>{line.fba_id}</Text>
              </View>
              <View style={[styles.dataCellCenter, styles.colQty]}>
                <Text>{line.qty_plts !== '' && line.qty_plts !== undefined ? String(line.qty_plts) : ''}</Text>
              </View>
              <View style={[styles.dataCellCenter, styles.colBox]}>
                <Text>{line.box !== '' && line.box !== undefined ? String(line.box) : ''}</Text>
              </View>
              <View style={[styles.dataCell, styles.colStorage]}>
                <Text>{line.storage}</Text>
              </View>
              <View style={[styles.dataCell, styles.colPo, { borderRightWidth: 0 }]}>
                <Text>{line.po_id}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 免责声明 */}
        <View style={styles.disclaimer}>
          <Text>{DISCLAIMER_EN}</Text>
          <Text style={{ marginTop: 4 }}>{DISCLAIMER_CN}</Text>
        </View>

        {/* Shipper Signature / Date */}
        <View style={styles.signatureRow}>
          <Text style={styles.signatureLabel}>Shipper Signature:</Text>
          <View style={styles.signatureLine} />
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Date:</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderColor: '#999', minHeight: 12 }} />
          </View>
        </View>

        {/* Receiver Signature / Date */}
        <View style={[styles.signatureRow, { marginTop: 6 }]}>
          <Text style={styles.signatureLabel}>Receiver Signature:</Text>
          <View style={styles.signatureLine} />
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Date:</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderColor: '#999', minHeight: 12 }} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
