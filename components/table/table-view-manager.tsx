/**
 * 表格视图管理器组件
 * 提供保存、切换和管理表格视图的功能
 */

"use client"

import * as React from "react"
import { LayoutGrid, Save, Trash2, Edit2, Star, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  TableView,
  getTableViews,
  getTableViewsSync,
  saveTableView,
  deleteTableView,
  updateTableView,
  setDefaultView,
  getDefaultViewSync,
} from "@/lib/table/view-manager"
import { cn } from "@/lib/utils"

interface TableViewManagerProps {
  tableName: string
  currentVisibility: Record<string, boolean>
  currentSizing?: Record<string, number>
  currentOrder?: string[]
  allColumns: string[]
  columnLabels?: Record<string, string>
  onViewChange: (visibility: Record<string, boolean>, sizing?: Record<string, number>, order?: string[]) => void
}

export function TableViewManager({
  tableName,
  currentVisibility,
  currentSizing,
  currentOrder,
  allColumns,
  columnLabels = {},
  onViewChange,
}: TableViewManagerProps) {
  const [views, setViews] = React.useState<TableView[]>([])
  const [currentViewId, setCurrentViewId] = React.useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [viewName, setViewName] = React.useState("")
  const [editingView, setEditingView] = React.useState<TableView | null>(null)
  const [deletingView, setDeletingView] = React.useState<TableView | null>(null)
  const [isDefault, setIsDefault] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  // 加载视图列表（异步）
  const loadViews = React.useCallback(async () => {
    try {
      const loadedViews = await getTableViews(tableName)
      setViews(loadedViews)
      
      // 检查当前可见性是否匹配某个视图
      const matchingView = loadedViews.find(view => {
        return allColumns.every(col => {
          const viewValue = view.columnVisibility[col] !== undefined 
            ? view.columnVisibility[col] 
            : true
          return viewValue === currentVisibility[col]
        })
      })
      
      if (matchingView) {
        setCurrentViewId(matchingView.id)
      } else {
        setCurrentViewId(null)
      }
    } catch (error) {
      console.error('加载视图列表失败:', error)
      // 失败时从缓存读取
      const cachedViews = getTableViewsSync(tableName)
      setViews(cachedViews)
    }
  }, [tableName, allColumns, currentVisibility])

  React.useEffect(() => {
    loadViews()
  }, [loadViews])

  // 应用视图
  const applyView = (view: TableView) => {
    // 构建完整的可见性对象，确保所有列都有明确的设置
    // react-table 的 columnVisibility: false 表示隐藏，true 表示显示
    const finalVisibility: Record<string, boolean> = {}
    allColumns.forEach(col => {
      // 如果视图中该列配置为 false（隐藏），设置为 false；否则设置为 true（显示）
      finalVisibility[col] = view.columnVisibility[col] === false ? false : true
    })
    
    // 调用 onViewChange 更新列可见性、列宽和列顺序
    onViewChange(finalVisibility, view.columnSizing, view.columnOrder)
    setCurrentViewId(view.id)
    
    // 延迟关闭下拉菜单，避免菜单定位问题
    setTimeout(() => {
      setDropdownOpen(false)
      toast.success(`已切换到视图: ${view.name}`)
    }, 100)
  }

  // 保存当前视图
  const handleSaveView = async () => {
    if (!viewName.trim()) {
      toast.error('请输入视图名称')
      return
    }

    setLoading(true)
    try {
      // 保存当前所有列的可见性状态
      const completeVisibility: Record<string, boolean> = {}
      allColumns.forEach(col => {
        completeVisibility[col] = currentVisibility[col] !== undefined 
          ? (currentVisibility[col] === false ? false : true)
          : true
      })
      
      const newView = await saveTableView(
        tableName,
        {
          name: viewName.trim(),
          columnVisibility: completeVisibility,
          columnSizing: currentSizing,
          columnOrder: currentOrder,
          isDefault,
        }
      )
      
      await loadViews()
      setCurrentViewId(newView.id)
      setSaveDialogOpen(false)
      setViewName("")
      setIsDefault(false)
      toast.success('视图已保存')
    } catch (error: any) {
      console.error('保存视图失败:', error)
      toast.error(error.message || '保存视图失败')
    } finally {
      setLoading(false)
    }
  }

  // 更新视图
  const handleUpdateView = async () => {
    if (!editingView || !viewName.trim()) {
      return
    }

    setLoading(true)
    try {
      await updateTableView(
        tableName,
        editingView.id,
        {
          name: viewName.trim(),
          isDefault,
        }
      )
      
      await loadViews()
      setEditDialogOpen(false)
      setEditingView(null)
      setViewName("")
      setIsDefault(false)
      toast.success('视图已更新')
    } catch (error: any) {
      console.error('更新视图失败:', error)
      toast.error(error.message || '更新视图失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除视图
  const handleDeleteView = async () => {
    if (!deletingView) return

    setLoading(true)
    try {
      await deleteTableView(tableName, deletingView.id)
      await loadViews()
      
      // 如果删除的是当前视图，清除当前视图ID
      if (currentViewId === deletingView.id) {
        setCurrentViewId(null)
      }
      
      setDeleteDialogOpen(false)
      setDeletingView(null)
      toast.success('视图已删除')
    } catch (error: any) {
      console.error('删除视图失败:', error)
      toast.error(error.message || '删除视图失败')
    } finally {
      setLoading(false)
    }
  }

  // 设置为默认视图
  const handleSetDefault = async (view: TableView) => {
    setLoading(true)
    try {
      await setDefaultView(tableName, view.id)
      await loadViews()
      toast.success('已设置为默认视图')
      
      // 如果设置的是当前视图，立即应用
      if (currentViewId === view.id) {
        applyView(view)
      }
    } catch (error: any) {
      console.error('设置默认视图失败:', error)
      toast.error(error.message || '设置默认视图失败')
    } finally {
      setLoading(false)
    }
  }

  // 打开编辑对话框
  const openEditDialog = (view: TableView) => {
    setEditingView(view)
    setViewName(view.name)
    setIsDefault(view.isDefault || false)
    setEditDialogOpen(true)
  }

  // 打开删除对话框
  const openDeleteDialog = (view: TableView) => {
    setDeletingView(view)
    setDeleteDialogOpen(true)
  }

  const currentView = views.find(v => v.id === currentViewId)
  const defaultView = getDefaultViewSync(tableName)

  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-2",
              currentView && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {currentView ? currentView.name : "视图"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel>表格视图</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {views.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              暂无保存的视图
            </div>
          ) : (
            views.map((view) => (
              <div key={view.id} className="group">
                <div className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm">
                  <DropdownMenuItem
                    className="flex-1 cursor-pointer p-0"
                    onSelect={(e) => {
                      e.preventDefault()
                      applyView(view)
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {view.isDefault && (
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      )}
                      <span className={cn(
                        "text-sm",
                        currentViewId === view.id && "font-semibold text-primary"
                      )}>
                        {view.name}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (!view.isDefault) {
                          handleSetDefault(view)
                        }
                      }}
                      title={view.isDefault ? "当前是默认视图" : "设为默认视图"}
                    >
                      <Star className={cn(
                        "h-3 w-3",
                        view.isDefault ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"
                      )} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        openEditDialog(view)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        openDeleteDialog(view)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            <Save className="mr-2 h-4 w-4" />
            保存当前视图
          </DropdownMenuItem>
          
          {defaultView && (
            <DropdownMenuItem onClick={() => applyView(defaultView)}>
              <Star className="mr-2 h-4 w-4 text-yellow-500 fill-yellow-500" />
              恢复默认视图
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 保存视图对话框 */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存视图</DialogTitle>
            <DialogDescription>
              保存当前的列显示配置为新的视图
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">视图名称</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="请输入视图名称"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveView()
                  }
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is-default" className="text-sm font-normal cursor-pointer">
                设为默认视图
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button onClick={handleSaveView} disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑视图对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑视图</DialogTitle>
            <DialogDescription>
              修改视图名称和默认状态
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-view-name">视图名称</Label>
              <Input
                id="edit-view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="请输入视图名称"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateView()
                  }
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-is-default" className="text-sm font-normal cursor-pointer">
                设为默认视图
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button onClick={handleUpdateView} disabled={loading}>
              <Check className="mr-2 h-4 w-4" />
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除视图 "{deletingView?.name}" 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteView} disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              {loading ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

