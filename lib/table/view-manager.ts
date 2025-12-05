/**
 * 表格视图管理工具
 * 用于保存、加载和管理表格的列显示配置
 */

export interface TableView {
  id: string
  name: string
  columnVisibility: Record<string, boolean>
  isDefault?: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_PREFIX = 'table_views_'

/**
 * 获取存储键名
 */
function getStorageKey(tableName: string, userId?: string | number): string {
  const userPart = userId ? `_${userId}` : ''
  return `${STORAGE_PREFIX}${tableName}${userPart}`
}

/**
 * 获取所有视图
 */
export function getTableViews(tableName: string, userId?: string | number): TableView[] {
  try {
    const key = getStorageKey(tableName, userId)
    const stored = localStorage.getItem(key)
    if (!stored) return []
    
    const views = JSON.parse(stored) as TableView[]
    return views.sort((a, b) => {
      // 默认视图排在前面
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      // 然后按更新时间倒序
      return b.updatedAt - a.updatedAt
    })
  } catch (error) {
    console.error('获取表格视图失败:', error)
    return []
  }
}

/**
 * 保存视图
 */
export function saveTableView(
  tableName: string,
  view: Omit<TableView, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  userId?: string | number
): TableView {
  const views = getTableViews(tableName, userId)
  
  // 如果设置为默认视图，取消其他视图的默认状态
  if (view.isDefault) {
    views.forEach(v => {
      if (v.isDefault) v.isDefault = false
    })
  }
  
  const newView: TableView = {
    ...view,
    id: view.id || `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  
  // 如果ID已存在，更新现有视图；否则添加新视图
  const existingIndex = views.findIndex(v => v.id === newView.id)
  if (existingIndex >= 0) {
    const existing = views[existingIndex]
    views[existingIndex] = {
      ...newView,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    }
  } else {
    views.push(newView)
  }
  
  try {
    const key = getStorageKey(tableName, userId)
    localStorage.setItem(key, JSON.stringify(views))
    return views.find(v => v.id === newView.id)!
  } catch (error) {
    console.error('保存表格视图失败:', error)
    throw error
  }
}

/**
 * 删除视图
 */
export function deleteTableView(
  tableName: string,
  viewId: string,
  userId?: string | number
): void {
  const views = getTableViews(tableName, userId)
  const filtered = views.filter(v => v.id !== viewId)
  
  try {
    const key = getStorageKey(tableName, userId)
    localStorage.setItem(key, JSON.stringify(filtered))
  } catch (error) {
    console.error('删除表格视图失败:', error)
    throw error
  }
}

/**
 * 获取默认视图
 */
export function getDefaultView(
  tableName: string,
  userId?: string | number
): TableView | null {
  const views = getTableViews(tableName, userId)
  return views.find(v => v.isDefault) || views[0] || null
}

/**
 * 应用视图到列可见性状态
 */
export function applyViewToVisibility(
  view: TableView | null,
  allColumns: string[]
): Record<string, boolean> {
  if (!view) {
    // 如果没有视图，默认显示所有列（返回空对象，react-table 会默认显示所有列）
    return {}
  }
  
  // 使用视图的列可见性配置
  // react-table 的 columnVisibility: false 表示隐藏，true 表示显示
  const visibility: Record<string, boolean> = {}
  allColumns.forEach(col => {
    // 如果视图中有配置，使用视图配置；否则默认显示（true）
    visibility[col] = view.columnVisibility[col] === false ? false : true
  })
  return visibility
}

