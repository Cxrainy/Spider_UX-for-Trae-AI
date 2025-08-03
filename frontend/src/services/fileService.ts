import api, { SpiderFile, PaginatedResponse, FileStatistics } from './api'

export interface FileListParams {
  page?: number
  per_page?: number
  file_type?: string
  search?: string
}

export interface UpdateFileRequest {
  description?: string
  tags?: string[]
}

export interface FileContentResponse {
  content: string
  file_type: string
  filename: string
}

class FileService {
  // 获取爬虫文件列表
  async getSpiderFiles(
    spiderId: number,
    params: FileListParams = {}
  ): Promise<PaginatedResponse<SpiderFile> & { statistics: FileStatistics }> {
    const response = await api.get(`/spiders/${spiderId}/files`, { params })
    return response
  }

  // 获取文件详情
  async getFileInfo(spiderId: number, fileId: number): Promise<SpiderFile> {
    const response = await api.get(`/spiders/${spiderId}/files/${fileId}`)
    return response
  }

  // 获取文件内容（预览）
  async getFileContent(spiderId: number, fileId: number): Promise<FileContentResponse> {
    const response = await api.get(`/spiders/${spiderId}/files/${fileId}/content`)
    return response
  }

  // 下载文件
  async downloadFile(spiderId: number, fileId: number): Promise<Blob> {
    const response = await api.get(`/spiders/${spiderId}/files/${fileId}/download`, {
      responseType: 'blob',
    })
    return response
  }

  // 上传文件
  async uploadFile(
    spiderId: number,
    file: File,
    description?: string,
    tags?: string[],
    executionId?: string
  ): Promise<SpiderFile> {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    if (tags) formData.append('tags', tags.join(','))
    if (executionId) formData.append('execution_id', executionId)

    const response = await api.post(`/spiders/${spiderId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response
  }

  // 更新文件信息
  async updateFileInfo(
    spiderId: number,
    fileId: number,
    data: UpdateFileRequest
  ): Promise<SpiderFile> {
    const response = await api.put(`/spiders/${spiderId}/files/${fileId}`, data)
    return response
  }

  // 删除文件
  async deleteFile(spiderId: number, fileId: number): Promise<{ message: string }> {
    const response = await api.delete(`/spiders/${spiderId}/files/${fileId}`)
    return response
  }

  // 批量删除文件
  async batchDeleteFiles(
    spiderId: number,
    fileIds: number[]
  ): Promise<{ message: string; deleted_count: number }> {
    const response = await api.post(`/spiders/${spiderId}/files/batch-delete`, {
      file_ids: fileIds,
    })
    return response
  }

  // 获取文件下载URL
  getDownloadUrl(spiderId: number, fileId: number): string {
    return `/api/spiders/${spiderId}/files/${fileId}/download`
  }

  // 根据文件类型获取图标
  getFileIcon(fileType: string): string {
    const iconMap: Record<string, string> = {
      csv: '📊',
      json: '📄',
      text: '📝',
      log: '📋',
      image: '🖼️',
      pdf: '📕',
      excel: '📗',
      html: '🌐',
      xml: '📰',
      unknown: '📄',
    }
    return iconMap[fileType] || iconMap.unknown
  }

  // 格式化文件大小
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 检查文件是否可预览
  isPreviewable(fileType: string): boolean {
    const previewableTypes = ['text', 'csv', 'json', 'html', 'xml', 'log']
    return previewableTypes.includes(fileType)
  }

  // 检查文件是否为图片
  isImage(fileType: string): boolean {
    return fileType === 'image'
  }
}

export const fileService = new FileService()
export default fileService