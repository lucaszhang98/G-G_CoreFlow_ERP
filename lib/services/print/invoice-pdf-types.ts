/**
 * 客户发票 PDF（INVOICE）数据类型
 */

export type InvoicePdfLineRow = {
  fee_code: string
  fee_name: string
  notes: string
  unit_price: string
  quantity: string
  amount: string
}

export type InvoicePdfPayload = {
  printTimeDate: string
  printTimeTime: string
  invoiceDateYmd: string
  containerNumber: string
  invoiceNumber: string
  billToName: string
  lines: InvoicePdfLineRow[]
  totalAmount: string
  logoDataUrl: string | null
}

/** 与样张一致的公司联系信息（固定文案） */
export const INVOICE_PDF_FIXED_ADDRESS = '851 81st Ave Ste H3, Oakland CA'
export const INVOICE_PDF_FIXED_EMAIL = 'info@hwhexpressinc.com'
export const INVOICE_PDF_FIXED_PHONE = '202-844-9833'
