import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { Download, X, FileText, Code, Database, Globe } from 'lucide-react'
import { fileService, FileContentResponse } from '../services/fileService'
import { useQuery } from '@tanstack/react-query'
import { SpiderFile } from '../services/api'

interface FilePreviewProps {
  file: SpiderFile | null
  spiderId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: (file: SpiderFile) => void
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  spiderId,
  open,
  onOpenChange,
  onDownload
}) => {
  const [error, setError] = useState<string | null>(null)

  // 获取文件内容
  const { data: fileContent, isLoading, error: queryError } = useQuery<FileContentResponse>({
    queryKey: ['fileContent', spiderId, file?.id],
    queryFn: () => fileService.getFileContent(spiderId, file!.id),
    enabled: open && !!file && fileService.isPreviewable(file.file_type),
    retry: false
  })

  // 处理查询错误
  useEffect(() => {
    if (queryError) {
      setError((queryError as any)?.response?.data?.error || '无法加载文件内容')
    }
  }, [queryError])

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'json':
      case 'csv':
        return <Database className="h-5 w-5" />
      case 'html':
      case 'xml':
        return <Globe className="h-5 w-5" />
      case 'code':
        return <Code className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case 'json':
        return 'bg-blue-100 text-blue-800'
      case 'csv':
        return 'bg-green-100 text-green-800'
      case 'html':
      case 'xml':
        return 'bg-orange-100 text-orange-800'
      case 'log':
        return 'bg-gray-100 text-gray-800'
      case 'text':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderContent = () => {
    if (!file) return null

    if (!fileService.isPreviewable(file.file_type)) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">无法预览此文件类型</h3>
          <p className="text-muted-foreground mb-4">
            文件类型 "{file.file_type}" 不支持预览
          </p>
          {onDownload && (
            <Button onClick={() => onDownload(file)} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              下载文件
            </Button>
          )}
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">加载中...</span>
        </div>
      )
    }

    if (error || queryError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <X className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground mb-4">
            {error || '无法加载文件内容'}
          </p>
          {onDownload && (
            <Button onClick={() => onDownload(file)} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              下载文件
            </Button>
          )}
        </div>
      )
    }

    if (!fileContent) {
      return (
        <div className="flex items-center justify-center py-12">
          <span className="text-muted-foreground">暂无内容</span>
        </div>
      )
    }

    return (
      <ScrollArea className="h-[500px] w-full">
        <pre className="text-sm font-mono whitespace-pre-wrap break-words p-4 bg-muted/50 rounded-md">
          {fileContent?.content}
        </pre>
      </ScrollArea>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {file && getFileIcon(file.file_type)}
              <div>
                <DialogTitle className="text-left">{file?.filename}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getFileTypeColor(file?.file_type || '')}>
                    {file?.file_type?.toUpperCase()}
                  </Badge>
                  {file?.file_size && (
                    <span className="text-sm text-muted-foreground">
                      {formatFileSize(file.file_size)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {file && onDownload && (
                <Button
                  onClick={() => onDownload(file)}
                  variant="outline"
                  size="sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FilePreview