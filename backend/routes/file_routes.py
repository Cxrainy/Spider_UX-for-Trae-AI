from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from database import Database

file_bp = Blueprint('file', __name__)

# 配置
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'csv', 'json', 'xml', 'html', 'py', 'js', 'css', 'log'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@file_bp.route('/spiders/<int:spider_id>/files', methods=['GET'])
def get_spider_files(spider_id):
    """获取爬虫的所有文件"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        file_type = request.args.get('file_type')
        search = request.args.get('search')
        execution_id = request.args.get('execution_id')
        
        # 构建查询条件
        conditions = ['spider_id = ?']
        params = [spider_id]
        
        if file_type == 'exclude_log':
            # 排除日志文件
            conditions.append('file_type != ?')
            params.append('log')
        elif file_type:
            conditions.append('file_type = ?')
            params.append(file_type)
        
        if search:
            conditions.append('(filename LIKE ? OR description LIKE ?)')
            search_term = f'%{search}%'
            params.extend([search_term, search_term])
        
        if execution_id:
            conditions.append('execution_id = ?')
            params.append(execution_id)
        
        where_clause = ' AND '.join(conditions)
        
        # 获取总数
        with db.get_connection() as conn:
            cursor = conn.cursor()
            count_query = f'SELECT COUNT(*) FROM spider_files WHERE {where_clause}'
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
        
        # 获取分页数据
        offset = (page - 1) * per_page
        query = f'''
            SELECT * FROM spider_files 
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        '''
        params.extend([per_page, offset])
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            files_data = cursor.fetchall()
        
        files = []
        for file_data in files_data:
            file_dict = dict(file_data)
            
            # 检查文件是否存在 - 使用绝对路径
            if file_dict['file_path']:
                # 如果是相对路径，转换为绝对路径
                if not os.path.isabs(file_dict['file_path']):
                    abs_path = os.path.abspath(file_dict['file_path'])
                else:
                    abs_path = file_dict['file_path']
                file_dict['exists'] = os.path.exists(abs_path)
                file_dict['absolute_path'] = abs_path
            else:
                file_dict['exists'] = False
                file_dict['absolute_path'] = None
            
            # 格式化文件大小
            if file_dict['file_size']:
                file_dict['formatted_size'] = _format_file_size(file_dict['file_size'])
            else:
                file_dict['formatted_size'] = 'Unknown'
            
            # 解析标签
            if file_dict['tags']:
                try:
                    import json
                    file_dict['tags_list'] = json.loads(file_dict['tags'])
                except:
                    file_dict['tags_list'] = []
            else:
                file_dict['tags_list'] = []
            
            files.append(file_dict)
        
        return jsonify({
            'files': files,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/<int:file_id>/download', methods=['GET'])
def download_file(spider_id, file_id):
    """下载文件（通过文件ID）"""
    try:
        db = Database()
        file_data = db.get_file(file_id)
        
        if not file_data or file_data['spider_id'] != spider_id:
            return jsonify({'error': 'File not found'}), 404
        
        if not os.path.exists(file_data['file_path']):
            return jsonify({'error': 'File not found on disk'}), 404
        
        return send_file(
            file_data['file_path'],
            as_attachment=True,
            download_name=file_data['filename']
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/download', methods=['GET'])
def download_file_by_name(spider_id):
    """通过文件名下载文件"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 获取文件名参数
        filename = request.args.get('filename')
        if not filename:
            return jsonify({'error': 'filename parameter is required'}), 400
        
        # 查找文件
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM spider_files WHERE spider_id = ? AND filename = ? ORDER BY created_at DESC LIMIT 1',
                (spider_id, filename)
            )
            file_data = cursor.fetchone()
        
        if not file_data:
            return jsonify({'error': 'File not found'}), 404
        
        file_dict = dict(file_data)
        
        # 检查文件是否存在于磁盘
        file_path = file_dict['file_path']
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found on disk'}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/<int:file_id>/json', methods=['GET'])
def get_file_as_json(spider_id, file_id):
    """将文件内容转换为JSON格式返回"""
    try:
        db = Database()
        file_data = db.get_file(file_id)
        
        if not file_data or file_data['spider_id'] != spider_id:
            return jsonify({'error': 'File not found'}), 404
        
        if not os.path.exists(file_data['file_path']):
            return jsonify({'error': 'File not found on disk'}), 404
        
        file_path = file_data['file_path']
        filename = file_data['filename'].lower()
        
        try:
            # 根据文件类型进行转换
            if filename.endswith('.csv'):
                import pandas as pd
                df = pd.read_csv(file_path, encoding='utf-8')
                data = df.to_dict('records')
            elif filename.endswith(('.xlsx', '.xls')):
                import pandas as pd
                df = pd.read_excel(file_path)
                data = df.to_dict('records')
            elif filename.endswith('.txt'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                data = {
                    'type': 'text',
                    'lines': [line.strip() for line in lines],
                    'content': ''.join(lines)
                }
            elif filename.endswith('.json'):
                import json
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                return jsonify({'error': 'File type not supported for JSON conversion'}), 400
            
            response = jsonify({
                'filename': file_data['filename'],
                'file_type': file_data['file_type'],
                'data': data,
                'total_records': len(data) if isinstance(data, list) else 1
            })
            response.headers['Content-Type'] = 'application/json; charset=utf-8'
            return response
            
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                if filename.endswith('.csv'):
                    import pandas as pd
                    df = pd.read_csv(file_path, encoding='gbk')
                    data = df.to_dict('records')
                elif filename.endswith('.txt'):
                    with open(file_path, 'r', encoding='gbk') as f:
                        lines = f.readlines()
                    data = {
                        'type': 'text',
                        'lines': [line.strip() for line in lines],
                        'content': ''.join(lines)
                    }
                else:
                    raise
                
                response = jsonify({
                    'filename': file_data['filename'],
                    'file_type': file_data['file_type'],
                    'data': data,
                    'total_records': len(data) if isinstance(data, list) else 1
                })
                response.headers['Content-Type'] = 'application/json; charset=utf-8'
                return response
            except Exception as e:
                return jsonify({'error': f'Failed to read file with different encoding: {str(e)}'}), 500
        
        except Exception as e:
            return jsonify({'error': f'Failed to convert file to JSON: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/<int:file_id>/content', methods=['GET'])
def get_file_content(spider_id, file_id):
    """获取文件内容（用于预览）"""
    try:
        db = Database()
        file_data = db.get_file(file_id)
        
        if not file_data or file_data['spider_id'] != spider_id:
            return jsonify({'error': 'File not found'}), 404
        
        if not os.path.exists(file_data['file_path']):
            return jsonify({'error': 'File not found on disk'}), 404
        
        # 限制预览的文件类型和大小
        if file_data['file_type'] not in ['text', 'csv', 'json', 'html', 'xml', 'log']:
            return jsonify({'error': 'File type not supported for preview'}), 400
        
        if file_data['file_size'] and file_data['file_size'] > 1024 * 1024:  # 1MB
            return jsonify({'error': 'File too large for preview'}), 400
        
        try:
            with open(file_data['file_path'], 'r', encoding='utf-8') as f:
                content = f.read()
            
            return jsonify({
                'content': content,
                'file_type': file_data['file_type'],
                'filename': file_data['filename']
            })
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                with open(file_data['file_path'], 'r', encoding='gbk') as f:
                    content = f.read()
                return jsonify({
                    'content': content,
                    'file_type': file_data['file_type'],
                    'filename': file_data['filename']
                })
            except:
                return jsonify({'error': 'Unable to decode file content'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files', methods=['POST'])
def upload_file(spider_id):
    """上传文件"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # 安全的文件名
        filename = secure_filename(file.filename)
        
        # 创建爬虫专用目录
        spider_dir = os.path.join(UPLOAD_FOLDER, f'spider_{spider_id}')
        os.makedirs(spider_dir, exist_ok=True)
        
        # 生成唯一文件名（避免冲突）
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        name, ext = os.path.splitext(filename)
        unique_filename = f"{name}_{timestamp}{ext}"
        file_path = os.path.join(spider_dir, unique_filename)
        
        # 保存文件
        file.save(file_path)
        
        # 获取文件信息
        file_size = os.path.getsize(file_path)
        file_type = _get_file_type(filename)
        
        # 处理标签
        tags = request.form.get('tags', '')
        tags_list = []
        if tags:
            tags_list = [tag.strip() for tag in tags.split(',')]
        
        # 创建文件记录
        file_id = db.create_spider_file(
            spider_id=spider_id,
            filename=filename,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            description=request.form.get('description', ''),
            tags=tags_list,
            execution_id=request.form.get('execution_id')
        )
        
        # 获取创建的文件信息
        file_data = db.get_file(file_id)
        file_dict = {
            'id': file_data['id'],
            'spider_id': file_data['spider_id'],
            'filename': file_data['filename'],
            'file_path': file_data['file_path'],
            'file_type': file_data['file_type'],
            'file_size': file_data['file_size'],
            'description': file_data['description'],
            'execution_id': file_data['execution_id'],
            'created_at': file_data['created_at'],
            'updated_at': file_data['updated_at'],
            'formatted_size': _format_file_size(file_data['file_size']),
            'exists': True
        }
        
        # 解析标签
        if file_data['tags']:
            try:
                import json
                file_dict['tags_list'] = json.loads(file_data['tags'])
            except:
                file_dict['tags_list'] = []
        else:
            file_dict['tags_list'] = []
        
        return jsonify(file_dict), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/<int:file_id>', methods=['PUT'])
def update_file_info(spider_id, file_id):
    """更新文件信息"""
    try:
        db = Database()
        file_data = db.get_file(file_id)
        
        if not file_data or file_data['spider_id'] != spider_id:
            return jsonify({'error': 'File not found'}), 404
        
        data = request.get_json()
        
        # 准备更新数据
        update_data = {}
        
        if 'description' in data:
            update_data['description'] = data['description']
        
        if 'tags' in data:
            import json
            update_data['tags'] = json.dumps(data['tags']) if data['tags'] else None
        
        if update_data:
            db.update_spider_file(file_id, **update_data)
        
        # 获取更新后的文件信息
        updated_file = db.get_file(file_id)
        file_dict = {
            'id': updated_file['id'],
            'spider_id': updated_file['spider_id'],
            'filename': updated_file['filename'],
            'file_path': updated_file['file_path'],
            'file_type': updated_file['file_type'],
            'file_size': updated_file['file_size'],
            'description': updated_file['description'],
            'execution_id': updated_file['execution_id'],
            'created_at': updated_file['created_at'],
            'updated_at': updated_file['updated_at'],
            'formatted_size': _format_file_size(updated_file['file_size']) if updated_file['file_size'] else 'Unknown',
            'exists': os.path.exists(updated_file['file_path']) if updated_file['file_path'] else False
        }
        
        # 解析标签
        if updated_file['tags']:
            try:
                import json
                file_dict['tags_list'] = json.loads(updated_file['tags'])
            except:
                file_dict['tags_list'] = []
        else:
            file_dict['tags_list'] = []
        
        return jsonify(file_dict)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/<int:file_id>', methods=['DELETE'])
def delete_file(spider_id, file_id):
    """删除文件"""
    try:
        db = Database()
        file_data = db.get_file(file_id)
        
        if not file_data or file_data['spider_id'] != spider_id:
            return jsonify({'error': 'File not found'}), 404
        
        # 删除物理文件
        if file_data['file_path'] and os.path.exists(file_data['file_path']):
            try:
                os.remove(file_data['file_path'])
            except OSError:
                pass  # 文件可能已被删除或无权限
        
        # 删除数据库记录
        db.delete_file(file_id)
        
        return jsonify({'message': 'File deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/batch-delete', methods=['POST'])
def batch_delete_files(spider_id):
    """批量删除文件"""
    try:
        db = Database()
        data = request.get_json()
        file_ids = data.get('file_ids', [])
        
        if not file_ids:
            return jsonify({'error': 'No file IDs provided'}), 400
        
        deleted_count = 0
        for file_id in file_ids:
            file_data = db.get_file(file_id)
            if file_data and file_data['spider_id'] == spider_id:
                # 删除物理文件
                if file_data['file_path'] and os.path.exists(file_data['file_path']):
                    try:
                        os.remove(file_data['file_path'])
                    except OSError:
                        pass
                
                # 删除数据库记录
                db.delete_file(file_id)
                deleted_count += 1
        
        return jsonify({
            'message': f'{deleted_count} files deleted successfully',
            'deleted_count': deleted_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _format_file_size(size_bytes):
    """格式化文件大小"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f} {size_names[i]}"

def _get_file_type(filename):
    """根据文件扩展名判断文件类型"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    type_mapping = {
        'txt': 'text',
        'log': 'log',
        'csv': 'csv',
        'json': 'json',
        'xml': 'xml',
        'html': 'html',
        'htm': 'html',
        'py': 'code',
        'js': 'code',
        'css': 'code',
        'pdf': 'document',
        'png': 'image',
        'jpg': 'image',
        'jpeg': 'image',
        'gif': 'image'
    }
    
    return type_mapping.get(ext, 'other')

@file_bp.route('/spiders/<int:spider_id>/files/batch-download', methods=['POST'])
def batch_download_files(spider_id):
    """批量下载文件，返回ZIP压缩包"""
    try:
        import zipfile
        import tempfile
        from io import BytesIO
        
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        data = request.get_json()
        file_ids = data.get('file_ids', [])
        
        if not file_ids:
            return jsonify({'error': 'No file IDs provided'}), 400
        
        # 创建内存中的ZIP文件
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            valid_files = 0
            
            for file_id in file_ids:
                file_data = db.get_file(file_id)
                
                if file_data and file_data['spider_id'] == spider_id:
                    file_path = file_data['file_path']
                    
                    if file_path and os.path.exists(file_path):
                        # 添加文件到ZIP，使用原始文件名
                        zip_file.write(file_path, file_data['filename'])
                        valid_files += 1
            
            if valid_files == 0:
                return jsonify({'error': 'No valid files found'}), 404
        
        zip_buffer.seek(0)
        
        # 生成ZIP文件名
        zip_filename = f"spider_{spider_id}_files_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/stats', methods=['GET'])
def get_files_stats(spider_id):
    """获取文件统计信息"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # 获取基本统计信息
            cursor.execute(
                'SELECT COUNT(*), SUM(file_size), AVG(file_size) FROM spider_files WHERE spider_id = ?',
                (spider_id,)
            )
            total_files, total_size, avg_size = cursor.fetchone()
            
            # 获取文件类型分布
            cursor.execute(
                'SELECT file_type, COUNT(*), SUM(file_size) FROM spider_files WHERE spider_id = ? GROUP BY file_type',
                (spider_id,)
            )
            type_distribution = cursor.fetchall()
            
            # 获取最新和最旧的文件
            cursor.execute(
                'SELECT filename, created_at FROM spider_files WHERE spider_id = ? ORDER BY created_at DESC LIMIT 1',
                (spider_id,)
            )
            latest_file = cursor.fetchone()
            
            cursor.execute(
                'SELECT filename, created_at FROM spider_files WHERE spider_id = ? ORDER BY created_at ASC LIMIT 1',
                (spider_id,)
            )
            oldest_file = cursor.fetchone()
            
            # 获取每日文件创建统计（最近7天）
            cursor.execute(
                '''
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM spider_files 
                WHERE spider_id = ? AND created_at >= datetime('now', '-7 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                ''',
                (spider_id,)
            )
            daily_stats = cursor.fetchall()
        
        # 格式化类型分布
        type_stats = []
        for file_type, count, size in type_distribution:
            type_stats.append({
                'type': file_type,
                'count': count,
                'total_size': size or 0,
                'formatted_size': _format_file_size(size or 0)
            })
        
        # 格式化每日统计
        daily_creation = []
        for date, count in daily_stats:
            daily_creation.append({
                'date': date,
                'count': count
            })
        
        stats = {
            'total_files': total_files or 0,
            'total_size': total_size or 0,
            'formatted_total_size': _format_file_size(total_size or 0),
            'average_size': avg_size or 0,
            'formatted_average_size': _format_file_size(avg_size or 0),
            'type_distribution': type_stats,
            'latest_file': {
                'filename': latest_file[0] if latest_file else None,
                'created_at': latest_file[1] if latest_file else None
            },
            'oldest_file': {
                'filename': oldest_file[0] if oldest_file else None,
                'created_at': oldest_file[1] if oldest_file else None
            },
            'daily_creation': daily_creation
        }
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@file_bp.route('/spiders/<int:spider_id>/files/search', methods=['GET'])
def search_files(spider_id):
    """搜索文件"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 获取搜索参数
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'error': 'Search query is required'}), 400
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        file_type = request.args.get('file_type')
        search_content = request.args.get('search_content', 'false').lower() == 'true'
        
        # 构建搜索条件
        conditions = ['spider_id = ?']
        params = [spider_id]
        
        # 文件名和描述搜索
        search_conditions = []
        search_params = []
        
        # 按文件名搜索
        search_conditions.append('filename LIKE ?')
        search_params.append(f'%{query}%')
        
        # 按描述搜索
        search_conditions.append('description LIKE ?')
        search_params.append(f'%{query}%')
        
        # 按标签搜索
        search_conditions.append('tags LIKE ?')
        search_params.append(f'%{query}%')
        
        # 如果启用内容搜索，需要读取文件内容（仅限文本文件）
        if search_content:
            # 先获取所有文本类型的文件
            text_file_ids = []
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT id, file_path FROM spider_files WHERE spider_id = ? AND file_type IN ("text", "csv", "json", "log", "html", "xml")',
                    (spider_id,)
                )
                text_files = cursor.fetchall()
            
            # 搜索文件内容
            content_matched_ids = []
            for file_id, file_path in text_files:
                if file_path and os.path.exists(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            if query.lower() in content.lower():
                                content_matched_ids.append(file_id)
                    except (UnicodeDecodeError, IOError):
                        try:
                            with open(file_path, 'r', encoding='gbk') as f:
                                content = f.read()
                                if query.lower() in content.lower():
                                    content_matched_ids.append(file_id)
                        except:
                            continue
            
            if content_matched_ids:
                search_conditions.append(f'id IN ({",".join(["?" for _ in content_matched_ids])})')
                search_params.extend(content_matched_ids)
        
        # 组合搜索条件
        if search_conditions:
            conditions.append(f'({" OR ".join(search_conditions)})')
            params.extend(search_params)
        
        # 文件类型过滤
        if file_type:
            conditions.append('file_type = ?')
            params.append(file_type)
        
        where_clause = ' AND '.join(conditions)
        
        # 获取总数
        with db.get_connection() as conn:
            cursor = conn.cursor()
            count_query = f'SELECT COUNT(*) FROM spider_files WHERE {where_clause}'
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
        
        # 获取分页数据
        offset = (page - 1) * per_page
        query_sql = f'''
            SELECT * FROM spider_files 
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        '''
        params.extend([per_page, offset])
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query_sql, params)
            files_data = cursor.fetchall()
        
        # 格式化文件数据
        files = []
        for file_data in files_data:
            file_dict = dict(file_data)
            
            # 检查文件是否存在
            if file_dict['file_path']:
                file_dict['exists'] = os.path.exists(file_dict['file_path'])
            else:
                file_dict['exists'] = False
            
            # 格式化文件大小
            if file_dict['file_size']:
                file_dict['formatted_size'] = _format_file_size(file_dict['file_size'])
            else:
                file_dict['formatted_size'] = 'Unknown'
            
            # 解析标签
            if file_dict['tags']:
                try:
                    import json
                    file_dict['tags_list'] = json.loads(file_dict['tags'])
                except:
                    file_dict['tags_list'] = []
            else:
                file_dict['tags_list'] = []
            
            files.append(file_dict)
        
        return jsonify({
            'files': files,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            },
            'search_query': query,
            'search_content_enabled': search_content
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500