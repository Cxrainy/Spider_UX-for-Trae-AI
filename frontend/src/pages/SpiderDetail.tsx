import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Play,
  Square,
  Edit,
  Trash2,
  RefreshCw,
  Calendar,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  BarChart3,
  Download,
  FileText,
  Settings,
  Eye,
  Copy,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { spiderService } from '../services/spiderService'
import { logService } from '../services/logService'
import { fileService } from '../services/fileService'
import { useRunningSpiders, useAddNotification } from '../store'
import { formatTime, getRelativeTime, formatFileSize } from '../lib/utils'
import FilePreview from '../components/FilePreview'
import { SpiderStatsCharts } from '../components/SpiderStatsCharts'
import { SpiderFile } from '../services/api'

export function SpiderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<SpiderFile | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fileDeleteDialogOpen, setFileDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<SpiderFile | null>(null)
  
  const queryClient = useQueryClient()
  const runningSpiders = useRunningSpiders()
  const addNotification = useAddNotification()
  
  const spiderId = parseInt(id!, 10)
  const isRunning = runningSpiders[spiderId]

  // 获取爬虫详情
  const { data: spider, isLoading, error } = useQuery({
    queryKey: ['spider', spiderId],
    queryFn: () => spiderService.getSpider(spiderId),
    enabled: !!spiderId,
  })

  // 获取爬虫状态
  const { data: status } = useQuery({
    queryKey: ['spider-status', spiderId],
    queryFn: () => spiderService.getSpiderStatus(spiderId),
    enabled: !!spiderId && !!isRunning,
    refetchInterval: isRunning ? 2000 : false,
  })

  // 监听爬虫运行状态变化，当爬虫完成时刷新数据
  const prevIsRunning = useRef(isRunning)
  useEffect(() => {
    // 如果爬虫从运行状态变为非运行状态，说明爬虫已完成
    if (prevIsRunning.current && !isRunning) {
      // 延迟一秒后刷新数据，确保后端数据已更新
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['spider', spiderId] })
        queryClient.invalidateQueries({ queryKey: ['spider-log-files', spiderId] })
        queryClient.invalidateQueries({ queryKey: ['spider-files', spiderId] })
      }, 1000)
    }
    prevIsRunning.current = isRunning
  }, [isRunning, spiderId, queryClient])

  // 获取日志文件
  const { data: logFilesData } = useQuery({
    queryKey: ['spider-log-files', spiderId],
    queryFn: () => fileService.getSpiderFiles(spiderId, { 
      file_type: 'log',
      per_page: 10 
    }),
    enabled: !!spiderId,
  })

  // 获取输出文件 - 分页状态
  const [filesPage, setFilesPage] = useState(1)
  const filesPerPage = 5
  
  const { data: filesData } = useQuery({
    queryKey: ['spider-files', spiderId, filesPage],
    queryFn: () => fileService.getSpiderFiles(spiderId, { 
      page: filesPage, 
      per_page: filesPerPage,
      file_type: 'exclude_log' // 排除日志文件
    }),
    enabled: !!spiderId,
  })

  // 运行爬虫
  const runSpiderMutation = useMutation({
    mutationFn: () => spiderService.runSpider(spiderId),
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        title: '爬虫启动成功',
        message: `执行ID: ${data.execution_id}`,
      })
      queryClient.invalidateQueries({ queryKey: ['spider', spiderId] })
      queryClient.invalidateQueries({ queryKey: ['spider-status', spiderId] })
    },
    onError: (error: any) => {
      console.error('Spider run error:', error)
      
      // 提取详细错误信息
      let errorTitle = '爬虫启动失败'
      let errorMessage = '未知错误'
      
      if (error.details) {
        errorMessage = error.details
      } else if (error.error) {
        errorMessage = error.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      addNotification({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
      })
    },
  })

  // 停止爬虫
  const stopSpiderMutation = useMutation({
    mutationFn: () => spiderService.stopSpider(spiderId),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: '爬虫已停止',
      })
      queryClient.invalidateQueries({ queryKey: ['spider', spiderId] })
      queryClient.invalidateQueries({ queryKey: ['spider-status', spiderId] })
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
    mutationFn: () => spiderService.deleteSpider(spiderId),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: '爬虫删除成功',
      })
      navigate('/spiders')
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: '删除爬虫失败',
        message: error.message || '未知错误',
      })
    },
  })

  // 删除文件
  const deleteFileMutation = useMutation({
    mutationFn: (fileId: number) => fileService.deleteFile(spiderId, fileId),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: '文件删除成功',
      })
      queryClient.invalidateQueries({ queryKey: ['spider-files', spiderId] })
      setFileDeleteDialogOpen(false)
      setFileToDelete(null)
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: '删除文件失败',
        message: error.message || '未知错误',
      })
    },
  })

  const handleRunSpider = () => {
    runSpiderMutation.mutate()
  }

  const handleStopSpider = () => {
    stopSpiderMutation.mutate()
  }

  const handleDeleteSpider = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    deleteSpiderMutation.mutate()
  }

  const handleDeleteFile = (file: SpiderFile) => {
    setFileToDelete(file)
    setFileDeleteDialogOpen(true)
  }

  const confirmDeleteFile = () => {
    if (fileToDelete) {
      deleteFileMutation.mutate(fileToDelete.id)
    }
  }

  const handleRefreshLogs = () => {
    queryClient.invalidateQueries({ queryKey: ['spider-log-files', spiderId] })
  }

  const handleRefreshFiles = () => {
    queryClient.invalidateQueries({ queryKey: ['spider-files', spiderId] })
  }

  const handleDownloadFile = async (file: SpiderFile) => {
    try {
      const blob = await fileService.downloadFile(spiderId, file.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      addNotification({
        type: 'success',
        title: '文件下载成功',
        message: `已下载文件: ${file.filename}`,
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: '文件下载失败',
        message: error.message || '未知错误',
      })
    }
  }

  const handlePreviewFile = (file: SpiderFile) => {
    setPreviewFile(file)
    setPreviewOpen(true)
  }

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          运行中
        </Badge>
      )
    }
    
    if (!spider) return null
    
    switch (spider.status) {
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            错误
          </Badge>
        )
      case 'stopped':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            已停止
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

  const getLogLevelBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <Badge variant="destructive">{level}</Badge>
      case 'warning':
        return <Badge variant="outline">{level}</Badge>
      case 'info':
        return <Badge variant="default">{level}</Badge>
      default:
        return <Badge variant="secondary">{level}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !spider) {
    return (
      <div className="text-center py-8">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-2 text-sm font-semibold">加载失败</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          无法加载爬虫详情，请稍后重试
        </p>
        <Button asChild className="mt-4">
          <Link to="/spiders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Link>
        </Button>
      </div>
    )
  }

  const logFiles = logFilesData?.items || logFilesData?.files || []
  const files = filesData?.items || filesData?.files || []
  const successRate = (spider.run_count || 0) > 0 
    ? ((spider.success_count || 0) / (spider.run_count || 0) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/spiders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{spider.name}</h1>
            <p className="text-muted-foreground">
              {spider.description || '暂无描述'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {getStatusBadge()}
          <Button variant="outline" asChild>
            <Link to={`/spiders/${spider.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Link>
          </Button>
          {isRunning ? (
            <Button
              variant="outline"
              onClick={handleStopSpider}
              disabled={stopSpiderMutation.isPending}
            >
              <Square className="mr-2 h-4 w-4" />
              停止
            </Button>
          ) : (
            <Button
              onClick={handleRunSpider}
              disabled={runSpiderMutation.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              运行
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleDeleteSpider}
            disabled={!!isRunning}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {/* 概览信息 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">执行次数</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{spider.run_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              成功 {spider.success_count || 0} 次
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {(spider.run_count || 0) > 0 ? '基于历史执行' : '暂无数据'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最后运行</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {spider.last_run_at ? (
              <>
                <div className="text-2xl font-bold">
                  {getRelativeTime(spider.last_run_at)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(spider.last_run_at)}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">从未</div>
                <p className="text-xs text-muted-foreground">尚未运行过</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">创建时间</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getRelativeTime(spider.created_at)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatTime(spider.created_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 统计图表 */}
      <SpiderStatsCharts spiderId={spiderId} />

      {/* 运行状态 */}
      {isRunning && status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              运行状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-muted-foreground">执行ID</div>
                <div className="text-lg font-mono">{status.runtime_info?.execution_id || status.execution_id || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">开始时间</div>
                <div className="text-lg">{formatTime(status.runtime_info?.start_time || status.start_time || '')}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">运行时长</div>
                <div className="text-lg">
                  {status.runtime_info?.start_time || status.start_time ? 
                    Math.floor((Date.now() - new Date(status.runtime_info?.start_time || status.start_time!).getTime()) / 1000) + 's' : 
                    'N/A'
                  }
                </div>
              </div>
            </div>
            {(status.runtime_info?.current_step || status.current_step) && (
              <div className="mt-4">
                <div className="text-sm font-medium text-muted-foreground">当前步骤</div>
                <div className="text-lg">{status.runtime_info?.current_step || status.current_step}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 详细信息 */}
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">配置信息</TabsTrigger>
          <TabsTrigger value="logs">执行日志</TabsTrigger>
          <TabsTrigger value="files">
          {spider.config?.type === 'rules' ? 'API配置' : '输出文件'}
        </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                爬虫配置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 根据爬虫类型显示不同内容 */}
                {spider.config?.type === 'rules' ? (
                  // 规则模式爬虫
                  <>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">目标URL</div>
                      <div className="text-lg font-mono bg-muted p-2 rounded">
                        {spider.config.url || '未配置'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">爬取规则</div>
                      <div className="text-lg bg-muted p-2 rounded">
                        {spider.config.rules ? (
                          <pre className="text-sm">{JSON.stringify(spider.config.rules, null, 2)}</pre>
                        ) : (
                          '未配置'
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">其他配置</div>
                      <div className="text-lg bg-muted p-2 rounded">
                        <pre className="text-sm">{JSON.stringify(spider.config, null, 2)}</pre>
                      </div>
                    </div>
                  </>
                ) : (
                  // 代码模式爬虫
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">爬虫代码</div>
                    <div className="text-lg bg-muted p-2 rounded max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap">{spider.code || '无代码'}</pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                执行日志
                <Button variant="outline" size="sm" className="ml-auto" onClick={handleRefreshLogs}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新
                </Button>
              </CardTitle>
              <CardDescription>
                最近 10 条日志记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">暂无日志文件</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    运行爬虫后将生成日志文件
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日志文件</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logFiles.map((logFile) => (
                      <TableRow key={logFile.id}>
                        <TableCell className="font-medium">
                          {logFile.filename}
                        </TableCell>
                        <TableCell>
                          {formatFileSize(logFile.file_size || 0)}
                        </TableCell>
                        <TableCell>
                          {formatTime(logFile.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handlePreviewFile(logFile)}>
                              <Eye className="mr-2 h-4 w-4" />
                              预览
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDownloadFile(logFile)}>
                              <Download className="mr-2 h-4 w-4" />
                              下载
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {spider.spider_type === 'rule' ? (
                  <>
                    <FileText className="h-5 w-5" />
                    API描述
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    输出文件
                    <Button variant="outline" size="sm" className="ml-auto" onClick={handleRefreshFiles}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      刷新
                    </Button>
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {spider.spider_type === 'rule' ? 'API接口调用说明' : '爬虫生成的文件'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {spider.config?.type === 'rules' ? (
                // 规则爬虫显示API描述
                <div className="space-y-6">
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold mb-2">API 接口调用说明</h4>
                    <p className="text-sm text-muted-foreground">
                      规则爬虫支持通过API接口进行调用，获取结构化数据
                    </p>
                  </div>
                  
                  {/* 爬虫调用API */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm font-medium mb-3">1. 爬虫数据获取API（推荐）</div>
                    <div className="space-y-2">
                      <div className="font-mono text-sm bg-background p-2 rounded border">
                        POST {window.location.origin}/api/spiders/{spiderId}/api-call
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-pre-line">
                        <strong>参数说明:</strong>
                        • 请求方式: POST
                        • Content-Type: application/json
                        • 请求体: {`{}`} (空JSON对象)
                        • <strong>频率限制:</strong> 调用间隔可在系统设置中配置（默认5分钟）
                        <strong>返回:</strong> 包含爬取数据的完整JSON响应
                        <strong>数据格式:</strong> {`{"success": true, "data": [...], "count": 10}`}
                        <strong>频率限制响应:</strong> {`{"success": false, "error": "API调用过于频繁", "retry_after": 300}`}
                        <strong>Content-Type:</strong> application/json
                        <strong>编码:</strong> UTF-8
                      </div>
                    </div>
                  </div>

                  {/* 爬虫启动API */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm font-medium mb-3">2. 爬虫启动API（异步执行）</div>
                    <div className="space-y-2">
                      <div className="font-mono text-sm bg-background p-2 rounded border">
                        POST {window.location.origin}/api/spiders/{spiderId}/run
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-pre-line">
                        <strong>参数说明:</strong>
                        • 请求方式: POST
                        • Content-Type: application/json
                        • 请求体: {`{}`}
                        <strong>返回:</strong> 执行状态信息
                        <strong>用途:</strong> 启动爬虫异步执行，不直接返回数据
                      </div>
                    </div>
                  </div>

                  {/* 爬虫状态查询API */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm font-medium mb-3">3. 爬虫状态查询API</div>
                    <div className="space-y-2">
                      <div className="font-mono text-sm bg-background p-2 rounded border">
                        GET {window.location.origin}/api/spiders/{spiderId}/status
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-pre-line">
                        <strong>参数说明:</strong>
                        • 请求方式: GET
                        • 无需请求体
                        <strong>返回:</strong> 爬虫当前状态信息
                        <strong>状态值:</strong> idle(空闲), running(运行中), completed(已完成), failed(失败)
                      </div>
                    </div>
                  </div>

                  {/* 示例调用 */}
                  <div className="bg-green-50 border border-green-200 p-4 rounded">
                    <div className="text-sm font-medium mb-3 text-green-900">示例API调用</div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-green-800 mb-1">cURL 示例（获取数据）:</div>
                        <div className="font-mono text-xs bg-white p-2 rounded border text-green-900">
                          curl -X POST {window.location.origin}/api/spiders/{spiderId}/api-call \
                          {"  "}-H "Content-Type: application/json" \
                          {"  "}-d '{}'
                        </div>
                        <div className="text-xs text-orange-600 mt-2">
                          ⚠️ 注意：此接口有频率限制（可在系统设置中配置），过于频繁调用将返回429状态码
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-green-800 mb-1">cURL 示例（启动爬虫）:</div>
                        <div className="font-mono text-xs bg-white p-2 rounded border text-green-900">
                          curl -X POST {window.location.origin}/api/spiders/{spiderId}/run \
                          {"  "}-H "Content-Type: application/json" \
                          {"  "}-d '{}'
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const curlCommand = `curl -X POST ${window.location.origin}/api/spiders/${spiderId}/run -H "Content-Type: application/json" -d '{"mode": "api"}'`
                            navigator.clipboard.writeText(curlCommand)
                            addNotification({
                              type: 'success',
                              title: '复制成功',
                              message: 'cURL命令已复制到剪贴板'
                            })
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          复制cURL命令
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const apiUrl = `${window.location.origin}/api/spiders/${spiderId}/run`
                            navigator.clipboard.writeText(apiUrl)
                            addNotification({
                              type: 'success',
                              title: '复制成功',
                              message: 'API地址已复制到剪贴板'
                            })
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          复制API地址
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // 自定义爬虫显示文件列表
                files.length === 0 ? (
                  <div className="text-center py-8">
                    <Download className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">暂无文件</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      运行爬虫后将显示生成的文件
                    </p>
                  </div>
                ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>文件名</TableHead>
                        <TableHead>大小</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="font-medium">
                            {file.filename}
                          </TableCell>
                          <TableCell>
                            {formatFileSize(file.file_size || 0)}
                          </TableCell>
                          <TableCell>
                            {formatTime(file.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {fileService.isPreviewable(file.file_type) && (
                                <Button variant="outline" size="sm" onClick={() => handlePreviewFile(file)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  预览
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => handleDownloadFile(file)}>
                                <Download className="mr-2 h-4 w-4" />
                                下载
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDeleteFile(file)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* 分页控件 */}
                  {filesData && filesData.pages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        显示第 {(filesPage - 1) * filesPerPage + 1} - {Math.min(filesPage * filesPerPage, filesData.total)} 条，共 {filesData.total} 条
                      </div>
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFilesPage(p => Math.max(1, p - 1))}
                          disabled={filesPage <= 1}
                        >
                          上一页
                        </Button>
                        <span className="text-sm">
                          {filesPage} / {filesData.pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFilesPage(p => Math.min(filesData.pages, p + 1))}
                          disabled={filesPage >= filesData.pages}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* API配置区域 */}
                  <div className="mt-6 border-t pt-6">
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold mb-2">API 接口文档</h4>
                      <p className="text-sm text-muted-foreground">
                        使用以下API接口可以程序化访问和下载爬虫生成的文件
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      {/* 文件下载API */}
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm font-medium mb-3">1. 文件下载API</div>
                        <div className="space-y-2">
                          <div className="font-mono text-sm bg-background p-2 rounded border">
                            GET {window.location.origin}/api/spiders/{'{id}'}/files/download?filename={'{filename}'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>参数说明:</strong>{"\n"}
                            • id: 爬虫ID (路径参数，必需){"\n"}
                            • filename: 文件名 (查询参数，必需，需要URL编码){"\n"}
                            <strong>返回:</strong> 文件二进制流{"\n"}
                            <strong>Content-Type:</strong> 根据文件类型自动设置{"\n"}
                            <strong>错误码:</strong> 400(参数错误), 404(文件不存在), 500(服务器错误)
                          </div>
                        </div>
                      </div>

                      {/* JSON转换API */}
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm font-medium mb-3">2. JSON格式转换API</div>
                        <div className="space-y-2">
                          <div className="font-mono text-sm bg-background p-2 rounded border">
                            GET {window.location.origin}/api/spiders/{'{id}'}/files/{'{file_id}'}/json
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>参数说明:</strong>{"\n"}
                            • id: 爬虫ID (路径参数，必需){"\n"}
                            • file_id: 文件ID (路径参数，必需){"\n"}
                            <strong>支持格式:</strong> CSV, Excel(.xlsx/.xls), TXT文件转换为JSON格式{"\n"}
                            <strong>返回:</strong> JSON格式数据{"\n"}
                            <strong>Content-Type:</strong> application/json{"\n"}
                            <strong>编码:</strong> UTF-8
                          </div>
                        </div>
                      </div>

                      {/* 文件列表API */}
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm font-medium mb-3">3. 文件列表API</div>
                        <div className="space-y-2">
                          <div className="font-mono text-sm bg-background p-2 rounded border">
                            GET {window.location.origin}/api/spiders/{'{id}'}/files?page={'{page}'}&per_page={'{per_page}'}&file_type={'{file_type}'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>参数说明:</strong>{"\n"}
                            • id: 爬虫ID (路径参数，必需){"\n"}
                            • page: 页码，默认1 (查询参数，可选，范围: 1-1000){"\n"}
                            • per_page: 每页数量，默认10 (查询参数，可选，范围: 1-100){"\n"}
                            • file_type: 文件类型过滤 (查询参数，可选，支持: csv, json, txt, xlsx, xls){"\n"}
                            <strong>返回:</strong> 分页文件列表JSON{"\n"}
                            <strong>字段:</strong> files(文件数组), total(总数), page(当前页), per_page(每页数量)
                          </div>
                        </div>
                      </div>

                      {/* 文件删除API */}
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm font-medium mb-3">4. 文件删除API</div>
                        <div className="space-y-2">
                          <div className="font-mono text-sm bg-background p-2 rounded border">
                            DELETE {window.location.origin}/api/spiders/{'{id}'}/files/{'{file_id}'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>参数说明:</strong>{"\n"}
                            • id: 爬虫ID (路径参数，必需){"\n"}
                            • file_id: 文件ID (路径参数，必需){"\n"}
                            <strong>返回:</strong> 删除结果JSON{"\n"}
                            <strong>成功:</strong> {`{"message": "文件删除成功"}`}{"\n"}
                            <strong>错误码:</strong> 400(参数错误), 404(文件不存在), 403(权限不足), 500(服务器错误)
                          </div>
                        </div>
                      </div>
                      
                      {/* 示例文件下载链接 */}
                      {files.length > 0 && (
                        <div className="space-y-3">
                          <div className="text-sm font-medium">示例API调用</div>
                          <div className="bg-green-50 border border-green-200 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-green-900">文件: {files[0].filename}</span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const apiUrl = `${window.location.origin}/api/spiders/${spiderId}/files/download?filename=${encodeURIComponent(files[0].filename)}`
                                  navigator.clipboard.writeText(apiUrl)
                                  addNotification({
                                    type: 'success',
                                    title: '复制成功',
                                    message: 'API链接已复制到剪贴板'
                                  })
                                }}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                复制链接
                              </Button>
                            </div>
                            <div className="font-mono text-xs bg-background p-2 rounded border break-all">
                              GET {window.location.origin}/api/spiders/{spiderId}/files/download?filename={encodeURIComponent(files[0].filename)}
                            </div>
                            
                            {/* JSON转换API示例 */}
                            {['csv', 'excel', 'txt'].some(type => files[0].filename.toLowerCase().includes(type)) && (
                              <div className="mt-3">
                                <div className="text-xs font-medium mb-1 text-green-900">JSON格式API:</div>
                                <div className="font-mono text-xs bg-background p-2 rounded border break-all">
                                  GET {window.location.origin}/api/spiders/{spiderId}/files/{files[0].id}/json
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 高级API功能 */}
                      <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                        <div className="text-sm font-medium text-purple-900 mb-3">5. 高级API功能</div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-medium text-purple-800 mb-1">批量文件下载:</div>
                            <div className="font-mono text-xs bg-background p-2 rounded border">
                              POST {window.location.origin}/api/spiders/{'{id}'}/files/batch-download
                            </div>
                            <div className="text-xs text-purple-700 mt-1">
                              请求体: {`{"file_ids": [1, 2, 3]}`} → 返回ZIP压缩包
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-purple-800 mb-1">文件统计信息:</div>
                            <div className="font-mono text-xs bg-background p-2 rounded border">
                              GET {window.location.origin}/api/spiders/{'{id}'}/files/stats
                            </div>
                            <div className="text-xs text-purple-700 mt-1">
                              返回: 文件总数、总大小、类型分布等统计信息
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-purple-800 mb-1">文件搜索:</div>
                            <div className="font-mono text-xs bg-background p-2 rounded border">
                              GET {window.location.origin}/api/spiders/{'{id}'}/files/search?q={'{keyword}'}
                            </div>
                            <div className="text-xs text-purple-700 mt-1">
                              支持按文件名、内容关键词搜索，返回匹配的文件列表
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 使用说明 */}
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <div className="text-sm font-medium text-blue-900 mb-2">使用说明</div>
                        <div className="text-sm text-blue-800 space-y-3">
                          <div>
                            <p className="font-medium mb-1">• 文件下载API使用方法:</p>
                            <p className="ml-4 text-xs">GET请求，filename参数需要URL编码，支持断点续传</p>
                            <code className="block ml-4 mt-1 bg-blue-100 px-2 py-1 rounded text-xs">curl -O "{window.location.origin}/api/spiders/1/files/download?filename=data.csv"</code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">• JSON转换API使用方法:</p>
                            <p className="ml-4 text-xs">自动检测文件编码，支持CSV、Excel、TXT转JSON，返回UTF-8编码</p>
                            <code className="block ml-4 mt-1 bg-blue-100 px-2 py-1 rounded text-xs">curl "{window.location.origin}/api/spiders/1/files/123/json"</code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">• Python调用示例:</p>
                            <code className="block ml-4 mt-1 bg-blue-100 px-2 py-1 rounded text-xs font-mono">
                              import requests{"\n"}
                              response = requests.get('{window.location.origin}/api/spiders/1/files/download?filename=data.csv'){"\n"}
                              with open('data.csv', 'wb') as f: f.write(response.content)
                            </code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">• JavaScript调用示例:</p>
                            <code className="block ml-4 mt-1 bg-blue-100 px-2 py-1 rounded text-xs font-mono">
                              {`fetch('${window.location.origin}/api/spiders/1/files/download?filename=data.csv')
.then(response => response.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  // 下载处理
})`}
                            </code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">• 认证和错误处理:</p>
                            <p className="ml-4 text-xs">API无需认证，建议添加错误处理逻辑，检查HTTP状态码</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 文件预览对话框 */}
      <FilePreview
        file={previewFile}
        spiderId={spiderId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={handleDownloadFile}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              您确定要删除爬虫 "{spider.name}" 吗？
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

      {/* 文件删除确认对话框 */}
      <Dialog open={fileDeleteDialogOpen} onOpenChange={setFileDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除文件</DialogTitle>
            <DialogDescription>
              您确定要删除文件 "{fileToDelete?.filename}" 吗？
              此操作将永久删除该文件，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFileDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteFile}
              disabled={deleteFileMutation.isPending}
            >
              {deleteFileMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}