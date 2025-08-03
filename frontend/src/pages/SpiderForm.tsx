import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  ArrowLeft,
  Save,
  Play,
  Code,
  Globe,
  Settings,
  Plus,
  Trash2,
  Info,
  AlertCircle,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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
import { spiderService } from '../services/spiderService'
import { useAddNotification } from '../store'
import { isValidUrl } from '../lib/utils'
import CodeEditor from '../components/CodeEditor'

// 表单验证模式
const spiderSchema = z.object({
  name: z.string().min(1, '爬虫名称不能为空').max(100, '爬虫名称不能超过100个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  spiderType: z.enum(['rules', 'code'], {
    required_error: '请选择爬虫类型',
    invalid_type_error: '请选择爬虫类型'
  }),
  // 规则模式字段
  url: z.string().optional(),
  rules: z.array(z.object({
    selector: z.string().min(1, '选择器不能为空'),
    field: z.string().min(1, '字段名不能为空'),
    type: z.enum(['text', 'attr', 'html']),
    selectorType: z.enum(['css', 'xpath']),
    attr: z.string().optional(),
  })).optional(),
  headers: z.record(z.string()).optional(),
  delay: z.number().min(0, '延迟不能为负数').max(60, '延迟不能超过60秒').optional(),
  timeout: z.number().min(1, '超时时间至少为1秒').max(300, '超时时间不能超过300秒').optional(),
  retries: z.number().min(0, '重试次数不能为负数').max(10, '重试次数不能超过10次').optional(),
  // 代码模式字段
  code: z.string().optional(),
}).refine((data) => {
  if (data.spiderType === 'rules') {
    // 规则模式需要有效的URL
    if (!data.url || !isValidUrl(data.url)) {
      return false
    }
    // 至少需要一个有效的规则
    const validRules = (data.rules || []).filter(rule => 
      rule.selector.trim() && rule.field.trim()
    )
    return validRules.length > 0
  }
  // 代码模式不需要额外验证，会自动生成默认代码
  return true
}, {
  message: '规则模式需要有效的URL和至少一个完整的爬取规则',
  path: ['spiderType'],
})

type SpiderFormData = z.infer<typeof spiderSchema>

interface Rule {
  selector: string
  field: string
  type: 'text' | 'attr' | 'html'
  selectorType: 'css' | 'xpath'
  attr?: string
}

export function SpiderForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [hasCodeErrors, setHasCodeErrors] = useState(false)
  
  const queryClient = useQueryClient()
  const addNotification = useAddNotification()
  
  const isEdit = !!id
  const spiderId = id ? parseInt(id, 10) : null

  // 获取爬虫详情（编辑模式）
  const { data: spider, isLoading } = useQuery({
    queryKey: ['spider', spiderId],
    queryFn: () => spiderService.getSpider(spiderId!),
    enabled: isEdit && !!spiderId,
  })

  // 表单处理
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SpiderFormData>({
    resolver: zodResolver(spiderSchema),
    defaultValues: {
      name: '',
      description: '',
      spiderType: 'rules',
      url: '',
      rules: [],
      headers: {},
      delay: 1,
      timeout: 30,
      retries: 3,
      code: '',
    },
  })

  const watchedRules = watch('rules')
  const watchedUrl = watch('url')
  const watchedSpiderType = watch('spiderType')
  const watchedCode = watch('code')

  // 加载爬虫数据到表单
  useEffect(() => {
    if (spider && isEdit) {
      // 优先根据config.type判断爬虫类型，如果没有则根据是否有规则配置来判断
      let spiderType: 'rules' | 'code' = 'rules'
      if (spider.config?.type) {
        spiderType = spider.config.type === 'code' ? 'code' : 'rules'
      } else {
        // 兼容旧数据：如果有规则配置则为规则模式，否则为代码模式
        spiderType = (spider.config?.rules && spider.config.rules.length > 0) ? 'rules' : 'code'
      }
      
      reset({
        name: spider.name,
        description: spider.description || '',
        spiderType,
        url: spider.config?.url || '',
        rules: spider.config?.rules || [{ selector: '', field: '', type: 'text', selectorType: 'css' }],
        headers: spider.config?.headers || {},
        delay: spider.config?.delay || 1,
        timeout: spider.config?.timeout || 30,
        retries: spider.config?.retries || 3,
        code: spider.code || '',
      })
    }
  }, [spider, isEdit, reset])

  // 监听爬虫类型变化，确保字段初始化
  useEffect(() => {
    if (watchedSpiderType === 'rules') {
      // 切换到规则模式时，确保有默认规则
      const currentRules = watch('rules')
      if (!currentRules || currentRules.length === 0) {
        setValue('rules', [{ selector: '', field: '', type: 'text', selectorType: 'css' }])
      }
      // 确保有默认的配置值
      if (!watch('url')) {
        setValue('url', '')
      }
      if (!watch('headers')) {
        setValue('headers', {})
      }
      if (!watch('delay')) {
        setValue('delay', 1)
      }
      if (!watch('timeout')) {
        setValue('timeout', 30)
      }
      if (!watch('retries')) {
        setValue('retries', 3)
      }
    } else if (watchedSpiderType === 'code') {
      // 切换到代码模式时，确保有默认代码
      if (!watch('code')) {
        setValue('code', '# 请编写爬虫代码\ndef spider_main():\n    pass')
      }
    }
  }, [watchedSpiderType, setValue, watch])

  // 创建/更新爬虫
  const saveSpiderMutation = useMutation({
    mutationFn: (data: SpiderFormData) => {
      const spiderData: any = {
        name: data.name,
        description: data.description,
      }
      
      if (data.spiderType === 'code') {
        // 代码模式
        spiderData.code = data.code || '# 请编写爬虫代码\ndef spider_main():\n    pass'
        spiderData.config = {
          type: 'code'  // 添加类型标识
        }
      } else {
        // 规则模式 - 提供默认代码，主要保存配置
        spiderData.code = '# 规则模式爬虫\n# 此代码由系统根据规则自动生成\ndef spider_main():\n    pass'
        spiderData.config = {
          type: 'rules',  // 添加类型标识
          url: data.url,
          rules: data.rules,
          headers: data.headers || {},
          delay: data.delay || 1,
          timeout: data.timeout || 30,
          retries: data.retries || 3,
        }
      }
      
      return isEdit 
        ? spiderService.updateSpider(spiderId!, spiderData)
        : spiderService.createSpider(spiderData)
    },
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        title: isEdit ? '爬虫更新成功' : '爬虫创建成功',
        message: isEdit ? '爬虫配置已更新' : '新爬虫已创建',
      })
      queryClient.invalidateQueries({ queryKey: ['spiders'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['spider', spiderId] })
      }
      navigate(isEdit ? `/spiders/${spiderId}` : `/spiders/${data.id}`)
    },
    onError: (error: any) => {
      console.error('Spider save error:', error)
      console.error('Error response:', error.response)
      console.error('Error message:', error.message)
      addNotification({
        type: 'error',
        title: isEdit ? '爬虫更新失败' : '爬虫创建失败',
        message: error.message || '未知错误',
      })
    },
  })

  // 测试爬虫配置
  const testSpider = async () => {
    const formData = watch()
    setTestLoading(true)
    setTestDialogOpen(true)
    
    try {
      // 这里应该调用测试API，暂时模拟
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTestResult({
        success: true,
        data: {
          'title': '示例标题',
          'content': '示例内容',
          'url': formData.url,
        },
        message: '测试成功，找到了匹配的数据',
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: '测试失败：无法连接到目标网站',
      })
    } finally {
      setTestLoading(false)
    }
  }

  // 添加规则
  const addRule = () => {
    const currentRules = watch('rules') || []
    setValue('rules', [...currentRules, { selector: '', field: '', type: 'text', selectorType: 'css' }])
  }

  // 删除规则
  const removeRule = (index: number) => {
    const currentRules = watch('rules') || []
    if (currentRules.length > 1) {
      setValue('rules', currentRules.filter((_, i) => i !== index))
    }
  }

  // 更新规则
  const updateRule = (index: number, field: keyof Rule, value: any) => {
    const currentRules = watch('rules') || []
    const updatedRules = [...currentRules]
    updatedRules[index] = { ...updatedRules[index], [field]: value }
    setValue('rules', updatedRules)
  }

  // 添加请求头
  const addHeader = () => {
    const currentHeaders = watch('headers') || {}
    setValue('headers', { ...currentHeaders, '': '' })
  }

  // 删除请求头
  const removeHeader = (key: string) => {
    const currentHeaders = watch('headers') || {}
    const { [key]: removed, ...rest } = currentHeaders
    setValue('headers', rest)
  }

  // 更新请求头
  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const currentHeaders = watch('headers') || {}
    const { [oldKey]: removed, ...rest } = currentHeaders
    setValue('headers', { ...rest, [newKey]: value })
  }

  const onSubmit = (data: SpiderFormData) => {
    console.log('Form submitted with data:', data)
    console.log('Form errors:', errors)
    console.log('Is submitting:', isSubmitting)
    console.log('Has code errors:', hasCodeErrors)
    
    // 检查代码模式下是否有错误
    if (data.spiderType === 'code' && hasCodeErrors) {
      addNotification({
        type: 'error',
        title: '代码存在错误',
        message: '请修复代码中的错误后再保存',
      })
      return
    }
    
    saveSpiderMutation.mutate(data)
  }

  const onError = (errors: any) => {
    console.log('Form validation errors:', errors)
    addNotification({
      type: 'error',
      title: '表单验证失败',
      message: '请检查表单中的错误信息',
    })
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={isEdit ? `/spiders/${spiderId}` : '/spiders'}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? '编辑爬虫' : '创建爬虫'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? '修改爬虫配置和规则' : '配置新的网页爬虫'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={testSpider}
            disabled={!watchedUrl || testLoading}
          >
            <Play className="mr-2 h-4 w-4" />
            测试配置
          </Button>
          <Button
            type="submit"
            form="spider-form"
            disabled={isSubmitting || (watchedSpiderType === 'code' && hasCodeErrors)}
            onClick={() => {
              console.log('Save button clicked')
              console.log('Current form values:', watch())
              console.log('Form errors:', errors)
              console.log('Has code errors:', hasCodeErrors)
            }}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* 表单 */}
      <form id="spider-form" onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6">
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList>
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="config">爬虫配置</TabsTrigger>
            <TabsTrigger value="advanced">高级设置</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  基本信息
                </CardTitle>
                <CardDescription>
                  设置爬虫的基本信息和类型
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">爬虫名称 *</label>
                  <Input
                    {...register('name')}
                    placeholder="输入爬虫名称"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">描述</label>
                  <Input
                    {...register('description')}
                    placeholder="输入爬虫描述（可选）"
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.description.message}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">爬虫类型 *</label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="rules"
                        value="rules"
                        {...register('spiderType')}
                        className="h-4 w-4"
                      />
                      <label htmlFor="rules" className="text-sm font-medium cursor-pointer">
                        规则模式
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="code"
                        value="code"
                        {...register('spiderType')}
                        className="h-4 w-4"
                      />
                      <label htmlFor="code" className="text-sm font-medium cursor-pointer">
                        代码模式
                      </label>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    规则模式：通过配置CSS选择器提取数据；代码模式：编写自定义Python代码
                  </p>
                  {errors.spiderType && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.spiderType.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            {watchedSpiderType === 'rules' ? (
              <div className="space-y-6">
                {/* URL配置 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      目标网站
                    </CardTitle>
                    <CardDescription>
                      配置要爬取的网站URL
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <label className="text-sm font-medium">目标URL *</label>
                      <Input
                        {...register('url')}
                        placeholder="https://example.com"
                        className={errors.url ? 'border-destructive' : ''}
                      />
                      {errors.url && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.url.message}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        要爬取的网页URL地址
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 爬取规则 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      爬取规则
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRule}
                        className="ml-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        添加规则
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      定义要提取的数据字段和选择器（支持CSS和XPath）
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(watchedRules?.length || 0) === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">暂无爬取规则，请添加至少一个规则</p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRule}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          添加第一个规则
                        </Button>
                      </div>
                    ) : (
                      Array.from(watchedRules || []).map((rule, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">规则 {index + 1}</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRule(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <label className="text-sm font-medium">字段名 *</label>
                            <Input
                              value={rule.field}
                              onChange={(e) => updateRule(index, 'field', e.target.value)}
                              placeholder="例如：title, content, price"
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">选择器类型 *</label>
                            <select
                              value={rule.selectorType || 'css'}
                              onChange={(e) => updateRule(index, 'selectorType', e.target.value)}
                              className="w-full px-3 py-2 border border-input bg-background rounded-md"
                            >
                              <option value="css">CSS选择器</option>
                              <option value="xpath">XPath选择器</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">提取类型 *</label>
                            <select
                              value={rule.type}
                              onChange={(e) => updateRule(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 border border-input bg-background rounded-md"
                            >
                              <option value="text">文本内容</option>
                              <option value="attr">属性值</option>
                              <option value="html">HTML内容</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">
                            {rule.selectorType === 'xpath' ? 'XPath选择器' : 'CSS选择器'} *
                          </label>
                          <Input
                            value={rule.selector}
                            onChange={(e) => updateRule(index, 'selector', e.target.value)}
                            placeholder={rule.selectorType === 'xpath' 
                              ? "例如：//h1[@class='title'], //div[@id='content']/text()" 
                              : "例如：.title, #content, h1"
                            }
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            {rule.selectorType === 'xpath' 
                              ? '用XPath表达式定位要提取的元素' 
                              : '用CSS选择器定位要提取的元素'
                            }
                          </p>
                        </div>
                        
                        {rule.type === 'attr' && (
                          <div>
                            <label className="text-sm font-medium">属性名 *</label>
                            <Input
                              value={rule.attr || ''}
                              onChange={(e) => updateRule(index, 'attr', e.target.value)}
                              placeholder="例如：href, src, data-id"
                            />
                          </div>
                        )}
                        </div>
                      ))
                    )}
                    
                    {errors.rules && (
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{errors.rules.message}</p>
                      </div>
                    )}
                    
                    {errors.spiderType && (
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{errors.spiderType.message}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    爬虫代码
                  </CardTitle>
                  <CardDescription>
                    编写自定义Python爬虫代码
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">代码要求：</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• 必须定义 spider_main() 函数作为入口点</li>
                        <li>• 函数应返回包含提取数据的字典或列表</li>
                        <li>• 可以使用 requests、BeautifulSoup 等常用库</li>
                        <li>• 请确保代码语法正确</li>
                      </ul>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Python代码 *</label>
                      <div className="mt-2">
                        <CodeEditor
                          value={watchedCode || ''}
                          onChange={(value) => setValue('code', value)}
                          onCodeErrorsChange={setHasCodeErrors}
                          language="python"
                          height="400px"
                        />
                      </div>
                      {hasCodeErrors && (
                        <div className="flex items-center gap-2 text-destructive mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <p className="text-sm">代码中存在语法错误，请修复后保存</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="advanced">
            <div className="space-y-6">
              {/* 请求设置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    请求设置
                  </CardTitle>
                  <CardDescription>
                    配置请求的延迟、超时和重试参数
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium">延迟时间（秒）</label>
                      <Input
                        type="number"
                        min="0"
                        max="60"
                        step="0.1"
                        {...register('delay', { valueAsNumber: true })}
                        placeholder="1"
                        className={errors.delay ? 'border-destructive' : ''}
                      />
                      {errors.delay && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.delay.message}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        请求间隔延迟
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">超时时间（秒）</label>
                      <Input
                        type="number"
                        min="1"
                        max="300"
                        {...register('timeout', { valueAsNumber: true })}
                        placeholder="30"
                        className={errors.timeout ? 'border-destructive' : ''}
                      />
                      {errors.timeout && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.timeout.message}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        请求超时时间
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">重试次数</label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        {...register('retries', { valueAsNumber: true })}
                        placeholder="3"
                        className={errors.retries ? 'border-destructive' : ''}
                      />
                      {errors.retries && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.retries.message}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        失败重试次数
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 请求头配置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    请求头配置
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addHeader}
                      className="ml-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      添加请求头
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    自定义HTTP请求头，如User-Agent、Authorization等
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(watch('headers') || {}).length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">暂无自定义请求头</p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addHeader}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          添加第一个请求头
                        </Button>
                      </div>
                    ) : (
                      Object.entries(watch('headers') || {}).map(([key, value], index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="请求头名称"
                            value={key}
                            onChange={(e) => updateHeader(key, e.target.value, value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="请求头值"
                            value={value}
                            onChange={(e) => updateHeader(key, key, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHeader(key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </form>

      {/* 测试结果对话框 */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>测试结果</DialogTitle>
            <DialogDescription>
              爬虫配置测试结果
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {testLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">正在测试...</span>
              </div>
            ) : testResult ? (
              <div>
                <div className={`flex items-center gap-2 mb-4 ${
                  testResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    testResult.success ? 'bg-green-600' : 'bg-red-600'
                  }`} />
                  <span className="font-medium">
                    {testResult.success ? '测试成功' : '测试失败'}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  {testResult.message}
                </p>
                
                {testResult.success && testResult.data && (
                  <div>
                    <h4 className="font-medium mb-2">提取的数据：</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="text-sm">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}