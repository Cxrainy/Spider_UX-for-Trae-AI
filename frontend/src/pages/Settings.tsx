import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Save,
  User,
  Bell,
  Shield,
  Database,
  Download,
  Upload,
  Trash2,
  CheckCircle,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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
import { useThemeStore, useAddNotification } from '../store'
import { settingsService } from '../services/settingsService'
import type { ProfileData, NotificationSettings, SystemSettings } from '../services/settingsService'

// 表单验证模式
const profileSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(50, '用户名不能超过50个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  displayName: z.string().max(100, '显示名称不能超过100个字符').optional(),
})

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  spiderSuccess: z.boolean(),
  spiderError: z.boolean(),
  systemUpdates: z.boolean(),
})

const systemSchema = z.object({
  maxConcurrentSpiders: z.number().min(1, '最小值为1').max(10, '最大值为10'),
  defaultTimeout: z.number().min(5, '最小值为5秒').max(300, '最大值为300秒'),
  defaultRetries: z.number().min(0, '最小值为0').max(10, '最大值为10'),
  logRetentionDays: z.number().min(1, '最小值为1天').max(365, '最大值为365天'),
  fileRetentionDays: z.number().min(1, '最小值为1天').max(365, '最大值为365天'),
  apiCallIntervalMinutes: z.number().min(1, '最小值为1分钟').max(60, '最大值为60分钟'),
})

type ProfileFormData = z.infer<typeof profileSchema>
type NotificationFormData = z.infer<typeof notificationSchema>
type SystemFormData = z.infer<typeof systemSchema>

export function Settings() {
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [, setLoading] = useState(true)
  
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  const addNotification = useAddNotification()

  // 个人资料表单
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: 'admin',
      email: 'admin@example.com',
      displayName: '管理员',
    },
  })

  // 通知设置表单
  const notificationForm = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      spiderSuccess: true,
      spiderError: true,
      systemUpdates: false,
    },
  })

  // 系统设置表单
  const systemForm = useForm<SystemFormData>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      maxConcurrentSpiders: 3,
      defaultTimeout: 30,
      defaultRetries: 3,
      logRetentionDays: 30,
      fileRetentionDays: 90,
      apiCallIntervalMinutes: 5,
    },
  })

  // 加载设置数据
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true)
        const [profileData, notificationData, systemData] = await Promise.all([
          settingsService.getProfile(),
          settingsService.getNotificationSettings(),
          settingsService.getSystemSettings(),
        ])
        
        profileForm.reset(profileData)
        notificationForm.reset(notificationData)
        systemForm.reset(systemData)
      } catch (error) {
        addNotification({
          type: 'error',
          title: '加载设置失败',
          message: '无法加载设置数据，请刷新页面重试',
        })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const onProfileSubmit = async (data: ProfileFormData) => {
    try {
      await settingsService.updateProfile(data)
      addNotification({
        type: 'success',
        title: '个人资料已保存',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: '个人资料保存失败，请重试',
      })
    }
  }

  const onNotificationSubmit = async (data: NotificationFormData) => {
    try {
      await settingsService.updateNotificationSettings(data)
      addNotification({
        type: 'success',
        title: '通知设置已保存',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: '通知设置保存失败，请重试',
      })
    }
  }

  const onSystemSubmit = async (data: SystemFormData) => {
    try {
      await settingsService.updateSystemSettings(data)
      addNotification({
        type: 'success',
        title: '系统设置已保存',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: '保存失败',
        message: '系统设置保存失败，请重试',
      })
    }
  }

  const handleExportData = async () => {
    try {
      const data = await settingsService.exportData()
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `spider-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setExportDialogOpen(false)
      addNotification({
        type: 'success',
        title: '数据导出成功',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: '导出失败',
        message: '数据导出失败，请重试',
      })
    }
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        await settingsService.importData(data)
        
        setImportDialogOpen(false)
        addNotification({
          type: 'success',
          title: '数据导入成功',
        })
      } catch (error) {
        addNotification({
          type: 'error',
          title: '数据导入失败',
          message: '文件格式不正确或导入失败',
        })
      }
    }
    reader.readAsText(file)
  }

  const handleClearData = async () => {
    try {
      await settingsService.clearAllData()
      setClearDataDialogOpen(false)
      addNotification({
        type: 'success',
        title: '数据已清空',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        title: '清空失败',
        message: '数据清空失败，请重试',
      })
    }
  }

  const themeOptions = [
    { value: 'light', label: '亮色', icon: Sun },
    { value: 'dark', label: '暗色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground">
          管理您的账户、通知和系统配置。
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">个人资料</TabsTrigger>
          <TabsTrigger value="notifications">通知设置</TabsTrigger>
          <TabsTrigger value="appearance">外观设置</TabsTrigger>
          <TabsTrigger value="system">系统设置</TabsTrigger>
          <TabsTrigger value="data">数据管理</TabsTrigger>
        </TabsList>

        {/* 个人资料 */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                个人资料
              </CardTitle>
              <CardDescription>
                管理您的账户信息和个人设置
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">用户名</label>
                  <Input
                    {...profileForm.register('username')}
                    className={profileForm.formState.errors.username ? 'border-destructive' : ''}
                  />
                  {profileForm.formState.errors.username && (
                    <p className="text-sm text-destructive mt-1">
                      {profileForm.formState.errors.username.message}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">邮箱地址</label>
                  <Input
                    type="email"
                    {...profileForm.register('email')}
                    className={profileForm.formState.errors.email ? 'border-destructive' : ''}
                  />
                  {profileForm.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {profileForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">显示名称</label>
                  <Input
                    {...profileForm.register('displayName')}
                    placeholder="可选"
                    className={profileForm.formState.errors.displayName ? 'border-destructive' : ''}
                  />
                  {profileForm.formState.errors.displayName && (
                    <p className="text-sm text-destructive mt-1">
                      {profileForm.formState.errors.displayName.message}
                    </p>
                  )}
                </div>
                
                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  保存更改
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 通知设置 */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                通知设置
              </CardTitle>
              <CardDescription>
                配置您希望接收的通知类型
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">邮件通知</div>
                      <div className="text-sm text-muted-foreground">
                        通过邮件接收重要通知
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      {...notificationForm.register('emailNotifications')}
                      className="h-4 w-4"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">爬虫成功通知</div>
                      <div className="text-sm text-muted-foreground">
                        爬虫执行成功时发送通知
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      {...notificationForm.register('spiderSuccess')}
                      className="h-4 w-4"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">爬虫错误通知</div>
                      <div className="text-sm text-muted-foreground">
                        爬虫执行失败时发送通知
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      {...notificationForm.register('spiderError')}
                      className="h-4 w-4"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">系统更新通知</div>
                      <div className="text-sm text-muted-foreground">
                        系统更新和维护通知
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      {...notificationForm.register('systemUpdates')}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
                
                <Button type="submit" disabled={notificationForm.formState.isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  保存设置
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 外观设置 */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                外观设置
              </CardTitle>
              <CardDescription>
                自定义应用的外观和主题
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-3 block">主题</label>
                  <div className="grid grid-cols-3 gap-3">
                    {themeOptions.map((option) => {
                      const Icon = option.icon
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                          className={`flex items-center gap-2 p-3 border rounded-lg hover:bg-muted transition-colors ${
                            theme === option.value ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-sm">{option.label}</span>
                          {theme === option.value && (
                            <CheckCircle className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 系统设置 */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                系统设置
              </CardTitle>
              <CardDescription>
                配置系统运行参数和默认值
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={systemForm.handleSubmit(onSystemSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">最大并发爬虫数</label>
                    <Input
                      type="number"
                      {...systemForm.register('maxConcurrentSpiders', { valueAsNumber: true })}
                      min="1"
                      max="10"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      同时运行的爬虫数量限制
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">默认超时时间（秒）</label>
                    <Input
                      type="number"
                      {...systemForm.register('defaultTimeout', { valueAsNumber: true })}
                      min="5"
                      max="300"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      新建爬虫的默认超时时间
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">默认重试次数</label>
                    <Input
                      type="number"
                      {...systemForm.register('defaultRetries', { valueAsNumber: true })}
                      min="0"
                      max="10"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      新建爬虫的默认重试次数
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">日志保留天数</label>
                    <Input
                      type="number"
                      {...systemForm.register('logRetentionDays', { valueAsNumber: true })}
                      min="1"
                      max="365"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      自动清理多少天前的日志
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">文件保留天数</label>
                    <Input
                      type="number"
                      {...systemForm.register('fileRetentionDays', { valueAsNumber: true })}
                      min="1"
                      max="365"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      自动清理多少天前的文件
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">API调用间隔（分钟）</label>
                    <Input
                      type="number"
                      {...systemForm.register('apiCallIntervalMinutes', { valueAsNumber: true })}
                      min="1"
                      max="60"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      /api-call接口的最小调用间隔
                    </p>
                  </div>
                </div>
                
                <Button type="submit" disabled={systemForm.formState.isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  保存设置
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 数据管理 */}
        <TabsContent value="data">
          <div className="space-y-6">
            {/* 数据导入导出 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  数据备份
                </CardTitle>
                <CardDescription>
                  导入和导出您的爬虫数据
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">导出数据</div>
                    <div className="text-sm text-muted-foreground">
                      导出所有爬虫、日志和文件数据
                    </div>
                  </div>
                  <Button onClick={() => setExportDialogOpen(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">导入数据</div>
                    <div className="text-sm text-muted-foreground">
                      从备份文件恢复数据
                    </div>
                  </div>
                  <Button onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    导入
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 危险操作 */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  危险操作
                </CardTitle>
                <CardDescription>
                  这些操作无法撤销，请谨慎操作
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">清空所有数据</div>
                    <div className="text-sm text-muted-foreground">
                      删除所有爬虫、日志、文件和设置
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setClearDataDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空数据
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 导出确认对话框 */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出数据</DialogTitle>
            <DialogDescription>
              将导出所有爬虫配置、执行日志和生成的文件。
              导出的文件可用于备份或迁移到其他系统。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleExportData}>
              <Download className="mr-2 h-4 w-4" />
              确认导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入确认对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入数据</DialogTitle>
            <DialogDescription>
              选择之前导出的数据文件进行导入。
              导入将覆盖现有的相同数据。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".json"
              onChange={handleImportData}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清空数据确认对话框 */}
      <Dialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认清空数据</DialogTitle>
            <DialogDescription>
              此操作将永久删除所有数据，包括：
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>所有爬虫配置</li>
                <li>执行历史和日志</li>
                <li>生成的文件</li>
                <li>系统设置</li>
              </ul>
              此操作无法撤销，请确认您已备份重要数据。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDataDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearData}>
              <Trash2 className="mr-2 h-4 w-4" />
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}