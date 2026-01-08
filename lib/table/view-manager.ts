/**
 * 表格视图管理工具（数据库持久化版本）
 * 策略：数据库作为主存储，localStorage 作为本地缓存
 */

export interface TableView {
  id: string
  name: string
  columnVisibility: Record<string, boolean>
  columnSizing?: Record<string, number>
  columnOrder?: string[]
  isDefault?: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_PREFIX = 'table_views_'
const CACHE_EXPIRY = 1000 * 60 * 5 // 5分钟缓存过期

/**
 * 获取存储键名
 */
function getStorageKey(tableName: string): string {
  return `${STORAGE_PREFIX}${tableName}`
}

/**
 * 从 localStorage 读取缓存
 * @param currentUserId 当前用户ID，用于验证缓存是否属于当前用户
 */
function getCachedViews(tableName: string, currentUserId?: string): TableView[] | null {
  try {
    const key = getStorageKey(tableName)
    const cached = localStorage.getItem(key)
    if (!cached) return null
    
    const data = JSON.parse(cached)
    
    // 如果提供了 currentUserId，验证缓存是否属于当前用户
    if (currentUserId && data.userId && data.userId !== currentUserId) {
      console.warn('缓存用户不匹配，清除缓存')
      localStorage.removeItem(key)
      return null
    }
    
    // 检查缓存是否过期
    if (data.timestamp && Date.now() - data.timestamp < CACHE_EXPIRY) {
      // 验证数据完整性
      const views = (data.views || []) as TableView[]
      return views.filter(v => v && v.columnVisibility !== undefined)
    }
    return null
  } catch (error) {
    console.warn('读取缓存失败:', error)
    return null
  }
}

/**
 * 写入 localStorage 缓存
 */
function setCachedViews(tableName: string, views: TableView[], userId?: string): void {
  try {
    const key = getStorageKey(tableName)
    localStorage.setItem(key, JSON.stringify({
      views,
      userId, // 存储用户ID，用于验证
      timestamp: Date.now(),
    }))
  } catch (error) {
    console.warn('写入缓存失败:', error)
  }
}

/**
 * 清除缓存
 */
function clearCache(tableName: string): void {
  try {
    const key = getStorageKey(tableName)
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('清除缓存失败:', error)
  }
}

/**
 * 从数据库获取所有视图
 */
async function fetchViewsFromDatabase(tableName: string): Promise<TableView[]> {
  try {
    const response = await fetch(`/api/table-views?table=${encodeURIComponent(tableName)}`)
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('用户未登录，无法获取视图')
        return []
      }
      throw new Error(`获取视图失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    const views = (result.data || [])
      .map((v: any) => ({
        id: v.id,
        name: v.view_name,
        columnVisibility: v.column_visibility || {},
        columnSizing: v.column_sizing || null,
        columnOrder: v.column_order || [],
        isDefault: v.is_default || false,
        createdAt: new Date(v.created_at).getTime(),
        updatedAt: new Date(v.updated_at).getTime(),
      }))
      .filter((v: TableView) => v.columnVisibility !== undefined)
    
    // 从第一个视图中提取 user_id（所有视图都属于同一用户）
    const userId = result.data && result.data.length > 0 ? result.data[0].user_id : undefined
    
    // 更新缓存，包含 user_id
    setCachedViews(tableName, views, userId)
    
    return views
  } catch (error) {
    console.error('从数据库获取视图失败:', error)
    throw error
  }
}

/**
 * 获取所有视图（优先从数据库，确保用户隔离）
 * 注意：为了确保用户切换时不会看到其他用户的缓存，我们始终从数据库加载
 */
export async function getTableViews(tableName: string): Promise<TableView[]> {
  try {
    // 直接从数据库加载，确保始终获取当前用户的数据
    return await fetchViewsFromDatabase(tableName)
  } catch (error) {
    console.error('获取视图失败，尝试从缓存读取:', error)
    // 如果数据库加载失败（如网络问题），尝试读取缓存
    const cached = getCachedViews(tableName)
    return cached || []
  }
}

/**
 * 同步版本的 getTableViews（用于非异步环境，仅返回缓存）
 * ⚠️ 不推荐使用：无法验证用户隔离，可能返回其他用户的缓存数据
 * 建议使用异步的 getTableViews() 替代
 * @deprecated
 */
export function getTableViewsSync(tableName: string): TableView[] {
  // 不使用缓存，直接返回空数组（因为无法验证用户）
  return []
}

/**
 * 保存视图（同时保存到数据库和缓存）
 */
export async function saveTableView(
  tableName: string,
  view: Omit<TableView, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<TableView> {
  try {
    const response = await fetch('/api/table-views', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        table_name: tableName,
        view_name: view.name,
        column_visibility: view.columnVisibility,
        column_sizing: view.columnSizing || null,
        column_order: view.columnOrder || [],
        is_default: view.isDefault || false,
      }),
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('用户未登录')
      }
      throw new Error(`保存视图失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    const savedView: TableView = {
      id: result.data.id,
      name: result.data.view_name,
      columnVisibility: result.data.column_visibility || {},
      columnSizing: result.data.column_sizing || null,
      columnOrder: result.data.column_order || [],
      isDefault: result.data.is_default || false,
      createdAt: new Date(result.data.created_at).getTime(),
      updatedAt: new Date(result.data.updated_at).getTime(),
    }
    
    // 清除缓存，下次会重新从数据库加载
    clearCache(tableName)
    
    return savedView
  } catch (error) {
    console.error('保存视图失败:', error)
    throw error
  }
}

/**
 * 删除视图（同时删除数据库和缓存）
 */
export async function deleteTableView(
  tableName: string,
  viewId: string
): Promise<void> {
  try {
    const response = await fetch(`/api/table-views/${viewId}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('用户未登录')
      }
      throw new Error(`删除视图失败: ${response.statusText}`)
    }
    
    // 清除缓存
    clearCache(tableName)
  } catch (error) {
    console.error('删除视图失败:', error)
    throw error
  }
}

/**
 * 更新视图（同时更新数据库和缓存）
 */
export async function updateTableView(
  tableName: string,
  viewId: string,
  updates: Partial<Omit<TableView, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<TableView> {
  try {
    const response = await fetch(`/api/table-views/${viewId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        view_name: updates.name,
        column_visibility: updates.columnVisibility,
        column_sizing: updates.columnSizing,
        column_order: updates.columnOrder,
        is_default: updates.isDefault,
      }),
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('用户未登录')
      }
      throw new Error(`更新视图失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    const updatedView: TableView = {
      id: result.data.id,
      name: result.data.view_name,
      columnVisibility: result.data.column_visibility || {},
      columnSizing: result.data.column_sizing || null,
      columnOrder: result.data.column_order || [],
      isDefault: result.data.is_default || false,
      createdAt: new Date(result.data.created_at).getTime(),
      updatedAt: new Date(result.data.updated_at).getTime(),
    }
    
    // 清除缓存
    clearCache(tableName)
    
    return updatedView
  } catch (error) {
    console.error('更新视图失败:', error)
    throw error
  }
}

/**
 * 设置为默认视图
 */
export async function setDefaultView(
  tableName: string,
  viewId: string
): Promise<void> {
  try {
    const response = await fetch(`/api/table-views/${viewId}/default`, {
      method: 'PATCH',
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('用户未登录')
      }
      throw new Error(`设置默认视图失败: ${response.statusText}`)
    }
    
    // 清除缓存
    clearCache(tableName)
  } catch (error) {
    console.error('设置默认视图失败:', error)
    throw error
  }
}

/**
 * 获取默认视图
 */
export async function getDefaultView(tableName: string): Promise<TableView | null> {
  const views = await getTableViews(tableName)
  return views.find(v => v.isDefault) || views[0] || null
}

/**
 * 同步版本的 getDefaultView（仅从缓存读取）
 * ⚠️ 不推荐使用：无法验证用户隔离
 * @deprecated
 */
export function getDefaultViewSync(tableName: string): TableView | null {
  // 不使用缓存，直接返回 null（因为无法验证用户）
  return null
}

/**
 * 应用视图到列可见性状态
 */
export function applyViewToVisibility(
  view: TableView | null,
  allColumns: string[]
): Record<string, boolean> {
  if (!view || !view.columnVisibility) {
    return {}
  }
  
  const visibility: Record<string, boolean> = {}
  allColumns.forEach(col => {
    // 跳过 undefined 或 null 的列
    if (col) {
      visibility[col] = view.columnVisibility[col] === false ? false : true
    }
  })
  return visibility
}

/**
 * 迁移工具：将 localStorage 中的旧数据迁移到数据库
 * 使用场景：升级到数据库存储后，一次性迁移现有数据
 */
export async function migrateLocalStorageToDatabase(): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }
  
  try {
    // 遍历 localStorage，找出所有旧的视图数据
    const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX))
    
    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key)
        if (!stored) continue
        
        const data = JSON.parse(stored)
        const views = Array.isArray(data) ? data : (data.views || [])
        
        // 提取表名
        const tableName = key.replace(STORAGE_PREFIX, '').split('_')[0]
        
        // 逐个保存到数据库
        for (const view of views) {
          try {
            await saveTableView(tableName, {
              name: view.name,
              columnVisibility: view.columnVisibility,
              columnSizing: view.columnSizing,
              columnOrder: view.columnOrder,
              isDefault: view.isDefault,
            })
            result.success++
          } catch (error: any) {
            result.failed++
            result.errors.push(`${tableName}/${view.name}: ${error.message}`)
          }
        }
        
        // 迁移成功后，删除旧的 localStorage 数据
        // localStorage.removeItem(key) // 暂时保留，以防迁移失败
      } catch (error: any) {
        result.failed++
        result.errors.push(`处理 ${key} 失败: ${error.message}`)
      }
    }
  } catch (error: any) {
    result.errors.push(`迁移过程失败: ${error.message}`)
  }
  
  return result
}

/**
 * 强制刷新缓存（从数据库重新加载）
 */
export async function refreshViewsCache(tableName: string): Promise<TableView[]> {
  clearCache(tableName)
  return await fetchViewsFromDatabase(tableName)
}

/**
 * 清除所有表格视图缓存（用于调试和升级后清理）
 * 建议在用户登出时调用，防止缓存泄露到其他用户
 */
export function clearAllViewsCache(): void {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX))
    keys.forEach(key => {
      localStorage.removeItem(key)
    })
    console.log(`已清除 ${keys.length} 个视图缓存`)
  } catch (error) {
    console.error('清除缓存失败:', error)
  }
}

/**
 * 在用户登出时调用，清除所有视图缓存
 * 防止下一个登录用户看到上一个用户的缓存
 */
export function onUserLogout(): void {
  clearAllViewsCache()
}
