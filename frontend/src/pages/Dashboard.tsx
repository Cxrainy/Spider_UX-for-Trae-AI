import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  Bug,
  FileText,
  Clock,
  Pause,
  TrendingUp,
  Plus,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { spiderService } from '../services/spiderService'
import { useSpiders, useRunningSpiders } from '../store'
import { formatTime, getRelativeTime } from '../lib/utils'
import { MonitorCharts } from '../components/MonitorCharts'

export function Dashboard() {
  const spiders = useSpiders()
  const runningSpiders = useRunningSpiders()
  const [stats, setStats] = useState({
    totalSpiders: 0,
    runningSpiders: 0,
    totalExecutions: 0,
    successRate: 0,
  })

  // 获取爬虫列表
  const { data: spidersData, isLoading } = useQuery({
    queryKey: ['spiders'],
    queryFn: () => spiderService.getSpiders(),
  })

  // 获取运行状态
  useEffect(() => {
    const fetchRunningStatus = async () => {
      if (spidersData?.spiders) {
        const runningCount = Object.keys(runningSpiders).length
        const totalExecutions = spidersData.spiders.reduce(
          (sum, spider) => sum + (spider.run_count || 0),
          0
        )
        const successfulExecutions = spidersData.spiders.reduce(
          (sum, spider) => sum + (spider.success_count || 0),
          0
        )
        const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0

        setStats({
          totalSpiders: spidersData.spiders.length,
          runningSpiders: runningCount,
          totalExecutions,
          successRate,
        })
      }
    }

    fetchRunningStatus()
  }, [spidersData, runningSpiders])

  const recentSpiders = spidersData?.spiders?.slice(0, 5) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground">
          欢迎使用可视化爬虫管理系统，这里是您的爬虫概览。
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总爬虫数</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSpiders}</div>
            <p className="text-xs text-muted-foreground">
              已创建的爬虫总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行中</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.runningSpiders}
            </div>
            <p className="text-xs text-muted-foreground">
              正在运行的爬虫数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总执行次数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExecutions}</div>
            <p className="text-xs text-muted-foreground">
              所有爬虫的执行总次数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              爬虫执行成功率
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 系统监控图表 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">系统监控</h2>
        <MonitorCharts />
      </div>

      {/* 最近的爬虫 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近的爬虫</CardTitle>
            <CardDescription>
              最近创建或更新的爬虫列表
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSpiders.length === 0 ? (
              <div className="text-center py-8">
                <Bug className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">暂无爬虫</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  开始创建您的第一个爬虫
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/spiders/create">
                      <Plus className="mr-2 h-4 w-4" />
                      创建爬虫
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recentSpiders.map((spider) => {
                  const isRunning = runningSpiders[spider.id]
                  return (
                    <div
                      key={spider.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Bug className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">
                            <Link
                              to={`/spiders/${spider.id}`}
                              className="hover:underline"
                            >
                              {spider.name}
                            </Link>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {spider.description || '暂无描述'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            更新于 {getRelativeTime(spider.updated_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            isRunning
                              ? 'default'
                              : spider.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {isRunning
                            ? '运行中'
                            : spider.status === 'error'
                            ? '错误'
                            : '空闲'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
                <div className="pt-4">
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/spiders">查看所有爬虫</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 运行状态 */}
        <Card>
          <CardHeader>
            <CardTitle>运行状态</CardTitle>
            <CardDescription>
              当前正在运行的爬虫状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(runningSpiders).length === 0 ? (
              <div className="text-center py-8">
                <Pause className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">暂无运行中的爬虫</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  所有爬虫当前都处于空闲状态
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(runningSpiders).map(([spiderId, status]) => {
                  const spider = spidersData?.spiders?.find(
                    (s) => s.id === parseInt(spiderId)
                  )
                  if (!spider) return null

                  return (
                    <div
                      key={spiderId}
                      className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-900/20"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="relative">
                            <Activity className="h-6 w-6 text-green-600" />
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">{spider.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            执行ID: {status.execution_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            开始时间: {formatTime(status.start_time)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">运行中</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {status.duration && `${Math.floor(status.duration / 60)}分钟`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>
            常用的操作和快捷方式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button asChild className="h-20 flex-col">
              <Link to="/spiders/create">
                <Plus className="h-6 w-6 mb-2" />
                创建新爬虫
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-20 flex-col">
              <Link to="/spiders">
                <Bug className="h-6 w-6 mb-2" />
                管理爬虫
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-20 flex-col">
              <Link to="/settings">
                <Settings className="h-6 w-6 mb-2" />
                系统设置
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}