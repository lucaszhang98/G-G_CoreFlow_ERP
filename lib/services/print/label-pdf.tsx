/**
 * Label PDF 组件（使用 @react-pdf/renderer）
 * 
 * 布局（横向 4×6 英寸）：
 * - 第一行：柜号
 * - 第二行：仓点
 * - 第三行：条形码（柜号+仓点代码）
 * - 第四行：左侧客户代码，右侧预计拆柜日期
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { LabelData } from './types'
import { PageSizes } from './print-templates'

// 页面尺寸（横向 4×6 英寸 = 152.4×101.6mm）
const LABEL_WIDTH = PageSizes.LABEL_4X6_LANDSCAPE.width
const LABEL_HEIGHT = PageSizes.LABEL_4X6_LANDSCAPE.height

// 样式定义
const styles = StyleSheet.create({
  page: {
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    paddingTop: 5, // 顶部边距（增加美感）
    paddingBottom: 5, // 底部边距（增加美感）
    paddingLeft: 6, // 左侧边距（减少以给内容更多空间）
    paddingRight: 6, // 右侧边距（减少以给内容更多空间）
    position: 'relative',
  },
  row1: {
    // 第一行：柜号（居中，更大更粗）
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 0,
    padding: 0,
    lineHeight: 1,
    position: 'absolute',
    top: 5, // 顶部 padding
    left: 6, // 左侧 padding（与 page paddingLeft 一致）
    right: 6, // 右侧 padding（与 page paddingRight 一致）
    height: 22, // 固定高度
  },
  row2: {
    // 第二行：仓点（居中，更大更粗，与第一行有适当间距）
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 0,
    padding: 0,
    lineHeight: 1,
    position: 'absolute',
    top: 30, // 第一行位置 5 + 第一行高度 22 + 间距 3 = 30
    left: 6, // 左侧 padding（与 page paddingLeft 一致）
    right: 6, // 右侧 padding（与 page paddingRight 一致）
    height: 20, // 固定高度
  },
  row3: {
    // 第三行：条形码区域（与第二行和第四行有适当间距）
    position: 'absolute',
    top: 53, // 第二行位置 30 + 第二行高度 20 + 间距 3 = 53
    bottom: 18, // 第四行高度 10 + 底部 padding 5 + 间距 3 = 18
    left: 6, // 左侧 padding（与 page paddingLeft 一致）
    right: 6, // 右侧 padding（与 page paddingRight 一致）
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch', // 拉伸对齐，确保条形码填满宽度
    justifyContent: 'flex-start', // 从顶部开始
    margin: 0,
    padding: 0,
    overflow: 'hidden', // 隐藏溢出部分
  },
  barcodeText: {
    fontSize: 8,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'Courier',
    lineHeight: 1,
  },
  barcodeImage: {
    width: '100%', // 使用 100% 宽度
    height: '100%', // 使用 100% 高度
    margin: 0,
    padding: 0,
    objectFit: 'fill', // 使用 fill 而不是 contain，确保填满容器
  },
  row4: {
    // 第四行：左侧客户代码，右侧预计拆柜日期和页码（与条形码有适当间距）
    position: 'absolute',
    bottom: 5, // 底部 padding
    left: 6, // 左侧 padding（与 page paddingLeft 一致）
    right: 6, // 右侧 padding（与 page paddingRight 一致）
    height: 10, // 固定高度
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    fontSize: 10,
    margin: 0,
    padding: 0,
    lineHeight: 1,
  },
  customerCode: {
    fontSize: 10, // 稍微增大
    fontWeight: 'bold',
    lineHeight: 1,
  },
  dateContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2, // 减少间距，确保内容不超出
    lineHeight: 1,
    flexShrink: 0, // 防止收缩
  },
  date: {
    fontSize: 10, // 稍微增大
    lineHeight: 1,
  },
  pageNumber: {
    // 页码（在日期右侧）
    fontSize: 8, // 稍微增大
    color: '#666',
    lineHeight: 1,
  },
})

interface LabelPDFProps {
  label: LabelData
  barcodeImage?: string // Base64 编码的条形码图片
  pageNumber?: number // 页码
}

/**
 * 单个 Label 页面组件
 */
export function LabelPage({ label, barcodeImage, pageNumber }: LabelPDFProps) {
  return (
    <Page size={[LABEL_WIDTH, LABEL_HEIGHT]} style={styles.page}>
      {/* 第一行：柜号（居中，更大更粗，无空隙） */}
      <Text style={styles.row1}>{label.containerNumber}</Text>

      {/* 第二行：仓点（居中，更大更粗，紧贴第一行，无空隙） */}
      <Text style={styles.row2}>
        {(() => {
          let location = label.deliveryLocation || ''
          // 如果性质是转仓，仓点后加*
          if (label.deliveryNature === '转仓') {
            location += '*'
          }
          // 如果性质是扣货，仓点后加hold
          else if (label.deliveryNature === '扣货') {
            location += 'hold'
          }
          return location
        })()}
      </Text>

      {/* 第三行：条形码（只显示图片，不显示文本，紧贴第二行和第四行） */}
      <View style={styles.row3}>
        {barcodeImage ? (
          <Image src={barcodeImage} style={styles.barcodeImage} />
        ) : (
          <Text style={styles.barcodeText}>{label.barcode}</Text>
        )}
      </View>

      {/* 第四行：左侧客户代码，右侧预计拆柜日期和页码（紧贴条形码，无空隙） */}
      <View style={styles.row4}>
        <Text style={styles.customerCode}>{label.customerCode}</Text>
        <View style={styles.dateContainer}>
          <Text style={styles.date}>{label.plannedUnloadDate}</Text>
          {pageNumber !== undefined && (
            <Text style={styles.pageNumber}>{pageNumber}</Text>
          )}
        </View>
      </View>
    </Page>
  )
}

/**
 * 多页 Label PDF 文档
 */
export function LabelsDocument({ labels, barcodeImages }: { labels: LabelData[], barcodeImages?: string[] }) {
  return (
    <Document>
      {labels.map((label, index) => (
        <LabelPage
          key={index}
          label={label}
          barcodeImage={barcodeImages?.[index]}
          pageNumber={index + 1} // 页码从1开始
        />
      ))}
    </Document>
  )
}

