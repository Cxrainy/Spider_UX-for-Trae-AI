import { useState, useCallback, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { AlertCircle, CheckCircle, Code, Zap, AlertTriangle } from 'lucide-react'
import { useAddNotification } from '../store'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
  placeholder?: string
  readOnly?: boolean
  className?: string
  onCodeErrorsChange?: (hasErrors: boolean) => void
}

interface CodeIssue {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
  type: string
}

export function CodeEditor({
  value,
  onChange,
  language = 'python',
  height = '400px',
  placeholder = '# 在这里编写您的爬虫代码\n# 示例：\n# import requests\n# from bs4 import BeautifulSoup\n\n# def spider_main():\n#     url = "https://example.com"\n#     response = requests.get(url)\n#     soup = BeautifulSoup(response.content, "html.parser")\n#     \n#     # 提取数据\n#     title = soup.find("title").text\n#     print(f"页面标题: {title}")\n#     \n#     return {"title": title}',
  readOnly = false,
  className = '',
  onCodeErrorsChange,
}: CodeEditorProps) {
  const [codeIssues, setCodeIssues] = useState<CodeIssue[]>([])
  const [isFormatting, setIsFormatting] = useState(false)
  const [showIssuesDialog, setShowIssuesDialog] = useState(false)
  const addNotification = useAddNotification()

  // 增强的代码审计函数
  const auditCode = useCallback((code: string): CodeIssue[] => {
    const issues: CodeIssue[] = []
    const lines = code.split('\n')
    
    if (!code.trim()) {
      return issues
    }
    
    // 检查语法错误和结构问题
    let spiderMainFound = false
    let spiderMainLine = -1
    let hasReturn = false
    let indentLevel = 0
    let inSpiderMain = false
    let importedModules = new Set<string>()
    let usedModules = new Set<string>()
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      const lineNumber = i + 1
      
      // 检查导入语句
      if (trimmedLine.startsWith('import ')) {
        const match = trimmedLine.match(/import\s+([\w,\s]+)/)
        if (match) {
          match[1].split(',').forEach(module => {
            importedModules.add(module.trim())
          })
        }
      } else if (trimmedLine.startsWith('from ')) {
        const match = trimmedLine.match(/from\s+(\w+)\s+import/)
        if (match) {
          importedModules.add(match[1])
        }
      }
      
      // 检查spider_main函数
      if (trimmedLine.includes('def spider_main(')) {
        spiderMainFound = true
        spiderMainLine = lineNumber
        inSpiderMain = true
        indentLevel = line.length - line.trimStart().length
      } else if (inSpiderMain && trimmedLine.startsWith('def ') && line.length - line.trimStart().length <= indentLevel) {
        inSpiderMain = false
      }
      
      // 在spider_main函数内检查return语句
      if (inSpiderMain && trimmedLine.startsWith('return')) {
        hasReturn = true
      }
      
      // 检查模块使用
      if (line.includes('requests.')) {
        usedModules.add('requests')
      }
      if (line.includes('BeautifulSoup')) {
        usedModules.add('bs4')
      }
      if (line.includes('json.')) {
        usedModules.add('json')
      }
      if (line.includes('re.')) {
        usedModules.add('re')
      }
      
      // 检查常见语法问题
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        // 检查缩进问题
        if (line.includes('\t')) {
          issues.push({
            line: lineNumber,
            column: line.indexOf('\t') + 1,
            message: '建议使用空格而不是制表符进行缩进',
            severity: 'warning',
            type: 'indentation'
          })
        }
        
        // 检查行长度
        if (line.length > 120) {
          issues.push({
            line: lineNumber,
            column: 121,
            message: '行长度超过120字符，建议换行',
            severity: 'info',
            type: 'line-length'
          })
        }
        
        // 检查未闭合的括号
        const openParens = (line.match(/\(/g) || []).length
        const closeParens = (line.match(/\)/g) || []).length
        if (openParens !== closeParens && !line.endsWith('\\')) {
          issues.push({
            line: lineNumber,
            column: line.length,
            message: '可能存在未闭合的括号',
            severity: 'warning',
            type: 'syntax'
          })
        }
      }
    }
    
    // 检查必需的spider_main函数
    if (!spiderMainFound) {
      issues.push({
        line: 1,
        column: 1,
        message: '缺少必需的spider_main()函数。这是爬虫的入口函数。',
        severity: 'error',
        type: 'missing-function'
      })
    } else {
      // 检查spider_main函数是否有返回值
      if (!hasReturn) {
        issues.push({
          line: spiderMainLine,
          column: 1,
          message: 'spider_main()函数应该返回爬取的数据（字典或列表）',
          severity: 'warning',
          type: 'missing-return'
        })
      }
    }
    
    // 检查导入的模块
    usedModules.forEach(module => {
      if (!importedModules.has(module)) {
        let suggestion = ''
        switch (module) {
          case 'requests':
            suggestion = '添加: import requests'
            break
          case 'bs4':
            suggestion = '添加: from bs4 import BeautifulSoup'
            break
          case 'json':
            suggestion = '添加: import json'
            break
          case 're':
            suggestion = '添加: import re'
            break
        }
        issues.push({
          line: 1,
          column: 1,
          message: `使用了${module}模块但未导入。${suggestion}`,
          severity: 'error',
          type: 'missing-import'
        })
      }
    })
    
    return issues
  }, [])

  // 增强的代码格式化
  const formatCode = useCallback(async () => {
    setIsFormatting(true)
    try {
      // 基本的Python代码格式化
      const formattedCode = formatPythonCode(value)
      
      if (formattedCode !== value) {
        onChange(formattedCode)
      }
    } catch (error) {
      console.warn('代码格式化失败:', error)
    } finally {
      setIsFormatting(false)
    }
  }, [value, onChange])
  
  // 简单的Python代码格式化函数
  const formatPythonCode = useCallback((code: string): string => {
    const lines = code.split('\n')
    const formattedLines: string[] = []
    let indentLevel = 0
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      const trimmedLine = line.trim()
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        formattedLines.push(line)
        continue
      }
      
      // 减少缩进级别
      if (trimmedLine.startsWith('except') || trimmedLine.startsWith('elif') || 
          trimmedLine.startsWith('else') || trimmedLine.startsWith('finally')) {
        indentLevel = Math.max(0, indentLevel - 1)
      }
      
      // 应用缩进
      const indentedLine = '    '.repeat(indentLevel) + trimmedLine
      formattedLines.push(indentedLine)
      
      // 增加缩进级别
      if (trimmedLine.endsWith(':')) {
        indentLevel++
      }
      
      // 减少缩进级别（用于下一行）
      if (trimmedLine.startsWith('return') || trimmedLine.startsWith('break') || 
          trimmedLine.startsWith('continue') || trimmedLine.startsWith('pass')) {
        // 这些语句后通常不需要增加缩进
      }
    }
    
    return formattedLines.join('\n')
  }, [])

  // 检查是否有阻止保存的错误
  const hasBlockingErrors = useCallback(() => {
    return codeIssues.some(issue => issue.severity === 'error')
  }, [codeIssues])

  // 显示代码审计结果的通知
  const showAuditNotifications = useCallback((issues: CodeIssue[]) => {
    // 只显示警告和提示的通知，错误仍然在界面上显示
    const warnings = issues.filter(issue => issue.severity === 'warning')
    const infos = issues.filter(issue => issue.severity === 'info')
    
    if (warnings.length > 0) {
      addNotification({
        type: 'warning',
        title: `发现 ${warnings.length} 个警告`,
        message: warnings[0].message + (warnings.length > 1 ? ` 等${warnings.length}个问题` : ''),
      })
    }
    
    if (infos.length > 0) {
      addNotification({
        type: 'info',
        title: `代码建议`,
        message: infos[0].message + (infos.length > 1 ? ` 等${infos.length}个建议` : ''),
      })
    }
  }, [addNotification])

  // 处理编辑器内容变化
  const handleEditorChange = useCallback((val: string | undefined) => {
    const newValue = val || ''
    onChange(newValue)
    
    // 实时代码审计
    const issues = auditCode(newValue)
    setCodeIssues(issues)
    
    // 调用错误状态回调
    const hasErrors = issues.some(issue => issue.severity === 'error')
    onCodeErrorsChange?.(hasErrors)
    
    // 显示警告和提示的通知（延迟显示，避免频繁弹出）
    const timeoutId = setTimeout(() => {
      showAuditNotifications(issues)
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [onChange, auditCode, showAuditNotifications, onCodeErrorsChange])

  // 初始化时进行代码审计
  useEffect(() => {
    const issues = auditCode(value)
    setCodeIssues(issues)
    
    // 调用错误状态回调
    const hasErrors = issues.some(issue => issue.severity === 'error')
    onCodeErrorsChange?.(hasErrors)
  }, [value, auditCode, onCodeErrorsChange])

  // Monaco Editor 配置
  const editorRef = useRef(null)
  
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    
    // 自定义深色主题
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'comment', foreground: '6a9955' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'delimiter', foreground: 'd4d4d4' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'variable', foreground: '9cdcfe' }
      ],
      colors: {
        'editor.background': '#020817',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.lineHighlightBackground': '#1e293b',
        'editor.selectionBackground': '#3b82f650',
        'editor.selectionHighlightBackground': '#3b82f630',
        'editorCursor.foreground': '#AEAFAD',
        'editorGutter.background': '#020817'
      }
    })
    
    monaco.editor.setTheme('custom-dark')
  }
  
  // 打开错误对话框
  const openIssuesDialog = useCallback(() => {
    const errors = codeIssues.filter(issue => issue.severity === 'error')
    if (errors.length > 0) {
      setShowIssuesDialog(true)
    }
  }, [codeIssues])

  return (
    <div className={`code-editor-container border rounded-lg overflow-hidden flex flex-col ${className}`} style={{ backgroundColor: '#020817', height }}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b" style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}>
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-white" />
          <span className="text-sm font-medium text-white">Python 代码编辑器</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 代码审计结果 */}
          <div className="flex items-center gap-1">
            {codeIssues.filter(issue => issue.severity === 'error').length === 0 ? (
              <Badge variant="secondary" className="text-green-600 bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-3 w-3 mr-1" />
                无错误
              </Badge>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openIssuesDialog}
                className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {codeIssues.filter(issue => issue.severity === 'error').length} 个错误
              </Button>
            )}
          </div>
          
          {/* 格式化按钮 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={formatCode}
            disabled={isFormatting || readOnly}
            className="text-white border-gray-600 hover:bg-gray-700"
          >
            <Zap className="h-3 w-3 mr-1" />
            {isFormatting ? '格式化中...' : '格式化'}
          </Button>
        </div>
      </div>
      
      {/* 代码错误模态框 */}
      <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              代码错误检查结果
            </DialogTitle>
            <DialogDescription>
              发现 {codeIssues.filter(issue => issue.severity === 'error').length} 个错误，必须修复后才能保存：
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {codeIssues.filter(issue => issue.severity === 'error').map((issue, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      第{issue.line}行{issue.column > 1 ? `:${issue.column}列` : ''}
                    </span>
                    {issue.type && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        {issue.type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{issue.message}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* 编辑器 */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={value || placeholder}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: readOnly,
            cursorStyle: 'line',
            cursorBlinking: 'blink',
            renderLineHighlight: 'all',
            selectionHighlight: true,
            occurrencesHighlight: true,
            codeLens: false,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            matchBrackets: 'always',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: false
          }}
        />
      </div>
    </div>
  )
}

export default CodeEditor