/**
 * 客户发票 INVOICE PDF（版式与业务提供样张一致）
 */

import React from 'react'
/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image 非 DOM img */
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { PageSizes } from './print-templates'
import { pdfFontFamily } from './register-pdf-font'
import type { InvoicePdfPayload } from './invoice-pdf-types'
import {
  INVOICE_PDF_FIXED_ADDRESS,
  INVOICE_PDF_FIXED_EMAIL,
  INVOICE_PDF_FIXED_PHONE,
} from './invoice-pdf-types'

const W = PageSizes.A4_PORTRAIT.width
const H = PageSizes.A4_PORTRAIT.height
const PAD = 24
const BORDER = '#000000'
const HEADER_BG = '#e8e8e8'
const BODY_FONT = pdfFontFamily

const cell = {
  fontSize: 8,
  padding: 5,
  borderRightWidth: 1,
  borderRightColor: BORDER,
}

const styles = StyleSheet.create({
  page: {
    width: W,
    minHeight: H,
    padding: PAD,
    fontSize: 9,
    fontFamily: BODY_FONT,
    color: '#000',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  printLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  printLabel: {
    fontSize: 9,
    fontFamily: BODY_FONT,
    marginRight: 8,
    marginBottom: 4,
  },
  printTimeLine: {
    fontSize: 9,
    fontFamily: BODY_FONT,
    lineHeight: 1.35,
  },
  logoBlock: {
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
    maxWidth: 200,
  },
  logoImg: {
    width: 120,
    height: 48,
    objectFit: 'contain',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: 'Times-Roman',
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  metaLeft: {
    width: '42%',
  },
  metaRight: {
    width: '52%',
    alignItems: 'flex-end',
  },
  metaLine: {
    fontSize: 9,
    fontFamily: BODY_FONT,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  metaLabel: {
    fontWeight: 'bold',
  },
  billTo: {
    fontSize: 10,
    fontFamily: BODY_FONT,
    marginBottom: 8,
  },
  billToBold: {
    fontWeight: 'bold',
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    minHeight: 22,
  },
  rowNoBottom: {
    flexDirection: 'row',
    minHeight: 22,
  },
  th: {
    ...cell,
    fontWeight: 'bold',
    fontFamily: 'Helvetica',
    backgroundColor: HEADER_BG,
    textAlign: 'center',
  },
  td: {
    ...cell,
    fontFamily: BODY_FONT,
  },
  tdLast: {
    fontSize: 8,
    padding: 5,
    fontFamily: BODY_FONT,
  },
  colCode: { width: '11%', textAlign: 'left' },
  colName: { width: '26%', textAlign: 'left' },
  colNotes: { width: '23%', textAlign: 'left' },
  colUnit: { width: '13%', textAlign: 'right' },
  colQty: { width: '12%', textAlign: 'right' },
  colAmt: { width: '15%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  totalBox: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: BORDER,
    width: '46%',
  },
  totalLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Helvetica',
    padding: 8,
    textAlign: 'center',
    borderRightWidth: 2,
    borderRightColor: BORDER,
  },
  totalValue: {
    width: '42%',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica',
    padding: 8,
    textAlign: 'right',
  },
})

export function InvoicePdfDocument({ data }: { data: InvoicePdfPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.printLeft}>
            <Text style={styles.printLabel}>打印时间</Text>
            <View>
              <Text style={styles.printTimeLine}>{data.printTimeDate}</Text>
              <Text style={styles.printTimeLine}>{data.printTimeTime}</Text>
            </View>
          </View>
          <View style={styles.logoBlock}>
            {data.logoDataUrl ? <Image src={data.logoDataUrl} style={styles.logoImg} /> : null}
          </View>
        </View>

        <Text style={styles.title}>INVOICE</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Date: </Text>
              {data.invoiceDateYmd}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Container: </Text>
              {data.containerNumber}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Invoice#: </Text>
              {data.invoiceNumber}
            </Text>
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>ADD: </Text>
              {INVOICE_PDF_FIXED_ADDRESS}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Email: </Text>
              {INVOICE_PDF_FIXED_EMAIL}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Phone: </Text>
              {INVOICE_PDF_FIXED_PHONE}
            </Text>
          </View>
        </View>

        <Text style={styles.billTo}>
          <Text style={styles.billToBold}>Bill To </Text>
          {data.billToName}
        </Text>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.th, styles.colCode]}>Fee Code</Text>
            <Text style={[styles.th, styles.colName]}>Fee Name</Text>
            <Text style={[styles.th, styles.colNotes]}>Notes</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit Price($)</Text>
            <Text style={[styles.th, styles.colQty]}>Quantity</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount($)</Text>
          </View>
          {data.lines.map((line, i) => {
            const last = i === data.lines.length - 1
            return (
              <View key={i} style={last ? styles.rowNoBottom : styles.row}>
                <Text style={[styles.td, styles.colCode]}>{line.fee_code}</Text>
                <Text style={[styles.td, styles.colName]}>{line.fee_name}</Text>
                <Text style={[styles.td, styles.colNotes]}>{line.notes}</Text>
                <Text style={[styles.td, styles.colUnit]}>{line.unit_price}</Text>
                <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
                <Text style={[styles.tdLast, styles.colAmt]}>{line.amount}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Amount ($)</Text>
            <Text style={styles.totalValue}>{data.totalAmount}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
