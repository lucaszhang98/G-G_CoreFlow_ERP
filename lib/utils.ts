import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 重新导出日期格式化工具函数（统一框架）
export {
  formatDateDisplay,
  formatDateTimeDisplay,
  autoFormatDateField,
  isDateField,
  isDateTimeField,
} from "./utils/date-format"

// 重新导出其他工具函数
export { formatDate, formatDateTime } from "./utils/date"
export { getStatusBadge, getContainerTypeBadge } from "./utils/badges"
export { formatCurrency, formatNumber } from "./utils/format"
