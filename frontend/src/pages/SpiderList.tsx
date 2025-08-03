import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Square,
  Edit,
  Trash2,
  Eye,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { spiderService } from '../services/spiderService'
import { useSpiders, useRunningSpiders, useAddNotification } from '../store'
import { formatTime, getRelativeTime, debounce } from '../lib/utils'
import { Spider } from '../services/api'

export function SpiderList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [spiderToDelete, setSpiderToDelete] = useState<Spider | null>(null)
  
  const queryClient = useQueryClient()
  const runningSpiders = useRunningSpiders()
  const addNotification = useAddNotification()

  // 获取爬虫列表
  const { data: spidersData, isLoading, error } = useQuery({
    queryKey: ['spiders', searchTerm],
    queryFn: () => spiderService.getSpiders({ search: searchTerm }),
  })

  // 运行爬虫
  const runSpiderMutation = useMutation({
    mutationFn: (spiderId: number) => spiderService.runSpider(spiderId),
    onSuccess: (data, spiderId) => {
      addNotification({
        type: 'success',
        title: '爬虫启动成功',
        message: `执行ID: ${data.execution_id}`,
      })
      queryClient.invalidateQueries({ queryKey: ['spiders'] })
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: '爬虫启动失败',
        message: error.message || '未知错误',
      })
    },
  })

  // 停止爬虫
  const stopSpiderMutation = useMutation({
    mutationFn: (spiderId: number) => spiderService.stopSpider(spiderId),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: '爬虫已停止',
      })
      queryClient.invalidateQueries({ queryKey: ['spiders'] })
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: '停止爬虫失败',
        message: error.message || '未知错误',
      })
    },
  })

  // 删除爬虫
  const deleteSpiderMutation = useMutation({
    mutationFn: (spiderId: number) => spiderService.deleteSpider(spiderId),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: '爬虫删除成功',
      })
      queryClient.invalidateQueries({ queryKey: ['spiders'] })
      setDeleteDialogOpen(false)
      setSpiderToDelete(null)
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: '删除爬虫失败',
        message: error.message || '未知错误',
      })
    },
  })

  // 防抖搜索
  const debouncedSearch = debounce((value: string) => {
    setSearchTerm(value)
  }, 300)

  const handleSearch = (value: string) => {
    debouncedSearch(value)
  }

  const handleRunSpider = (spiderId: number) => {
    runSpiderMutation.mutate(spiderId)
  }

  const handleStopSpider = (spiderId: number) => {
    stopSpiderMutation.mutate(spiderId)
  }

  const handleDeleteSpider = (spider: Spider) => {
    setSpiderToDelete(spider)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (spiderToDelete) {
      deleteSpiderMutation.mutate(spiderToDelete.id)
    }
  }

  const getStatusBadge = (spider: Spider) => {
    const isRunning = runningSpiders[spider.id]
    
    if (isRunning) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          运行中
        </Badge>
      )
    }
    
    switch (spider.status) {
      case 'stopped':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            已停止
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            错误
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            空闲
          </Badge>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-2 text-sm font-semibold">加载失败</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          无法加载爬虫列表，请稍后重试
        </p>
      </div>
    )
  }

  const spiders = spidersData?.spiders || []

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">爬虫管理</h1>
          <p className="text-muted-foreground">
            管理您的所有爬虫，查看运行状态和执行历史。
          </p>
        </div>
        <Button asChild>
          <Link to="/spiders/create">
            <Plus className="mr-2 h-4 w-4" />
            创建爬虫
          </Link>
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardHeader>
          <CardTitle>搜索和过滤</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索爬虫名称或描述..."
                className="pl-10"
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              过滤
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 爬虫列表 */}
      <Card>
        <CardHeader>
          <CardTitle>爬虫列表</CardTitle>
          <CardDescription>
            共 {spiders.length} 个爬虫
          </CardDescription>
        </CardHeader>
        <CardContent>
          {spiders.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
                🕷️
              </div>
              <h3 className="text-lg font-semibold">暂无爬虫</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? '没有找到匹配的爬虫' : '开始创建您的第一个爬虫'}
              </p>
              {!searchTerm && (
                <Button asChild>
                  <Link to="/spiders/create">
                    <Plus className="mr-2 h-4 w-4" />
                    创建爬虫
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>执行次数</TableHead>
                  <TableHead>成功率</TableHead>
                  <TableHead>最后运行</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spiders.map((spider) => {
                  const isRunning = runningSpiders[spider.id]
                  const successRate = (spider.run_count || 0) > 0 
                    ? ((spider.success_count || 0) / (spider.run_count || 0) * 100).toFixed(1)
                    : '0'
                  
                  return (
                    <TableRow key={spider.id}>
                      <TableCell>
                        <div>
                          <Link
                            to={`/spiders/${spider.id}`}
                            className="font-medium hover:underline"
                          >
                            {spider.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {spider.description || '暂无描述'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            spider.config?.type === 'rules' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {spider.config?.type === 'rules' ? '规则爬虫' : '自定义爬虫'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(spider)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>总计: {spider.run_count || 0}</div>
                          <div className="text-muted-foreground">
                            成功: {spider.success_count || 0}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="text-sm font-medium">
                            {successRate}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {spider.last_run_at ? (
                            <>
                              <div>{formatTime(spider.last_run_at)}</div>
                              <div className="text-muted-foreground">
                                {getRelativeTime(spider.last_run_at)}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">从未运行</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatTime(spider.created_at)}</div>
                          <div className="text-muted-foreground">
                            {getRelativeTime(spider.created_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link to={`/spiders/${spider.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                查看详情
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/spiders/${spider.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isRunning ? (
                              <DropdownMenuItem
                                onClick={() => handleStopSpider(spider.id)}
                                disabled={stopSpiderMutation.isPending}
                              >
                                <Square className="mr-2 h-4 w-4" />
                                停止运行
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleRunSpider(spider.id)}
                                disabled={runSpiderMutation.isPending}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                立即运行
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteSpider(spider)}
                              className="text-destructive"
                              disabled={!!isRunning}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              您确定要删除爬虫 "{spiderToDelete?.name}" 吗？
              此操作将永久删除爬虫及其所有相关数据，包括执行历史、日志和文件。
              此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteSpiderMutation.isPending}
            >
              {deleteSpiderMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}