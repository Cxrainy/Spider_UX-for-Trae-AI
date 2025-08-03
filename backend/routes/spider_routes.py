from flask import Blueprint, request, jsonify, current_app
from utils.spider_runner import SpiderRunner
from datetime import datetime, timedelta
import json
import os

spider_bp = Blueprint('spider', __name__)
spider_runner = SpiderRunner()

def get_db():
    """获取数据库实例"""
    from database import db
    return db

@spider_bp.route('/spiders', methods=['GET'])
def get_spiders():
    """获取所有爬虫列表"""
    db = get_db()
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        
        # 获取所有爬虫
        all_spiders = db.get_all_spiders()
        
        # 过滤
        filtered_spiders = []
        for spider in all_spiders:
            # 搜索过滤
            if search:
                if search.lower() not in spider['name'].lower() and search.lower() not in (spider['description'] or '').lower():
                    continue
            
            # 状态过滤
            if status and spider['status'] != status:
                continue
                
            # 处理config字段
            if spider['config']:
                try:
                    spider['config'] = json.loads(spider['config'])
                except:
                    spider['config'] = {}
            else:
                spider['config'] = {}
                
            filtered_spiders.append(spider)
        
        # 分页
        total = len(filtered_spiders)
        start = (page - 1) * per_page
        end = start + per_page
        spiders_page = filtered_spiders[start:end]
        
        return jsonify({
            'spiders': spiders_page,
            'total': total,
            'pages': (total + per_page - 1) // per_page,
            'current_page': page,
            'per_page': per_page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders/<int:spider_id>', methods=['GET'])
def get_spider(spider_id):
    """获取单个爬虫详情"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
            
        # 处理config字段
        if spider['config']:
            try:
                spider['config'] = json.loads(spider['config'])
            except:
                spider['config'] = {}
        else:
            spider['config'] = {}
            
        return jsonify(spider)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders', methods=['POST'])
def create_spider():
    """创建新爬虫"""
    db = get_db()
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('name'):
            return jsonify({'error': 'Spider name is required'}), 400
        
        if not data.get('code'):
            return jsonify({'error': 'Spider code is required'}), 400
        
        # 检查名称是否已存在
        all_spiders = db.get_all_spiders()
        for spider in all_spiders:
            if spider['name'] == data['name']:
                return jsonify({'error': 'Spider name already exists'}), 400
        
        # 创建爬虫
        spider_id = db.create_spider(
            name=data['name'],
            description=data.get('description', ''),
            code=data['code'],
            config=data.get('config', {})
        )
        
        # 记录创建日志
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'Spider "{data["name"]}" created successfully',
            source='user'
        )
        
        # 获取创建的爬虫
        spider = db.get_spider(spider_id)
        if spider['config']:
            try:
                spider['config'] = json.loads(spider['config'])
            except:
                spider['config'] = {}
        else:
            spider['config'] = {}
            
        return jsonify(spider), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders/<int:spider_id>', methods=['PUT'])
def update_spider(spider_id):
    """更新爬虫"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
            
        data = request.get_json()
        
        # 检查名称冲突（如果名称有变化）
        if data.get('name') and data['name'] != spider['name']:
            all_spiders = db.get_all_spiders()
            for s in all_spiders:
                if s['name'] == data['name'] and s['id'] != spider_id:
                    return jsonify({'error': 'Spider name already exists'}), 400
        
        # 准备更新数据
        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'description' in data:
            update_data['description'] = data['description']
        if 'code' in data:
            update_data['code'] = data['code']
        if 'config' in data:
            update_data['config'] = data['config']
        
        # 更新爬虫
        success = db.update_spider(spider_id, **update_data)
        if not success:
            return jsonify({'error': 'Failed to update spider'}), 500
        
        # 记录更新日志
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'Spider "{data.get("name", spider["name"])}" updated successfully',
            source='user'
        )
        
        # 获取更新后的爬虫
        updated_spider = db.get_spider(spider_id)
        if updated_spider['config']:
            try:
                updated_spider['config'] = json.loads(updated_spider['config'])
            except:
                updated_spider['config'] = {}
        else:
            updated_spider['config'] = {}
            
        return jsonify(updated_spider)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders/<int:spider_id>', methods=['DELETE'])
def delete_spider(spider_id):
    """删除爬虫"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 检查爬虫是否正在运行
        if spider['status'] == 'running':
            return jsonify({'error': 'Cannot delete running spider'}), 400
        
        spider_name = spider['name']
        
        # 删除相关文件
        files = db.get_spider_files(spider_id)
        for file in files:
            file_path = file['file_path']
            if file_path:
                # 如果是相对路径，转换为绝对路径
                if not os.path.isabs(file_path):
                    file_path = os.path.abspath(file_path)
                
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        print(f"Deleted file: {file_path}")
                    except Exception as e:
                        print(f"Error deleting file {file_path}: {e}")
                else:
                    print(f"File not found: {file_path}")
        
        # 删除爬虫目录（如果为空）
        try:
            spider_files_dir = os.path.abspath(os.path.join('spider_files', f'spider_{spider_id}'))
            spider_logs_dir = os.path.abspath(os.path.join('spider_logs', f'spider_{spider_id}'))
            
            # 删除文件目录
            if os.path.exists(spider_files_dir):
                import shutil
                shutil.rmtree(spider_files_dir, ignore_errors=True)
                print(f"Deleted spider files directory: {spider_files_dir}")
            
            # 删除日志目录
            if os.path.exists(spider_logs_dir):
                import shutil
                shutil.rmtree(spider_logs_dir, ignore_errors=True)
                print(f"Deleted spider logs directory: {spider_logs_dir}")
                
        except Exception as e:
            print(f"Error deleting spider directories: {e}")
        
        # 删除数据库记录
        db.delete_spider_files(spider_id)
        db.delete_spider_logs(spider_id)
        success = db.delete_spider(spider_id)
        
        if not success:
            return jsonify({'error': 'Failed to delete spider'}), 500
        
        return jsonify({'message': f'Spider "{spider_name}" deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders/<int:spider_id>/run', methods=['POST'])
def run_spider(spider_id):
    """运行爬虫"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 检查爬虫状态
        if spider['status'] == 'running':
            return jsonify({'error': 'Spider is already running'}), 400
        
        # 启动爬虫
        execution_id = spider_runner.run_spider(spider_id)
        
        return jsonify({
            'message': f'Spider "{spider["name"]}" started successfully',
            'execution_id': execution_id,
            'status': 'running'
        })
    except Exception as e:
        import traceback
        error_details = {
            'error': str(e),
            'type': type(e).__name__,
            'details': str(e)
        }
        
        # 如果是特定的爬虫错误，提供更详细的信息
        if 'already running' in str(e).lower():
            error_details['error'] = f'爬虫 "{spider["name"] if spider else "未知"}" 已在运行中'
        elif 'not found' in str(e).lower():
            error_details['error'] = '爬虫不存在或已被删除'
        elif 'code' in str(e).lower() and 'error' in str(e).lower():
            error_details['error'] = '爬虫代码存在语法错误或运行时错误'
            error_details['details'] = str(e)
        else:
            error_details['error'] = f'爬虫启动失败: {str(e)}'
        
        return jsonify(error_details), 500

@spider_bp.route('/spiders/<int:spider_id>/stop', methods=['POST'])
def stop_spider(spider_id):
    """停止爬虫"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        if spider['status'] != 'running':
            return jsonify({'error': 'Spider is not running'}), 400
        
        # 停止爬虫
        spider_runner.stop_spider(spider_id)
        
        return jsonify({
            'message': f'Spider "{spider["name"]}" stopped successfully',
            'status': 'stopped'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders/<int:spider_id>/status', methods=['GET'])
def get_spider_status(spider_id):
    """获取爬虫运行状态"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 获取运行时信息
        runtime_info = spider_runner.get_spider_status(spider_id)
        
        return jsonify({
            'spider_id': spider_id,
            'status': spider['status'],
            'runtime_info': runtime_info,
            'last_run_at': spider['last_run_at'],
            'run_count': spider['run_count'],
            'success_count': spider['success_count'],
            'error_count': spider['error_count']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@spider_bp.route('/spiders/<int:spider_id>/api-call', methods=['POST'])
def spider_api_call(spider_id):
    """规则爬虫API调用模式 - 直接返回爬取数据"""
    db = get_db()
    try:
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 检查爬虫是否为规则模式
        config = spider.get('config', {})
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except:
                config = {}
        
        spider_type = config.get('type', 'code')
        if spider_type != 'rules':
            return jsonify({'error': 'This endpoint only supports rule-based spiders'}), 400
        
        # 获取系统设置中的API调用间隔限制
        try:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT value FROM settings WHERE key = ?', ('system',))
                result = cursor.fetchone()
                
            if result:
                system_settings = json.loads(result[0])
                api_interval_minutes = system_settings.get('apiCallIntervalMinutes', 5)
            else:
                api_interval_minutes = 5  # 默认5分钟
        except Exception:
            api_interval_minutes = 5  # 出错时使用默认值
        
        # 检查API调用频率限制
        if spider.get('last_run_at'):
            try:
                last_run_time = datetime.fromisoformat(spider['last_run_at'])
                current_time = datetime.now()
                time_diff = (current_time - last_run_time).total_seconds()
                
                # 转换分钟为秒
                interval_seconds = api_interval_minutes * 60
                if time_diff < interval_seconds:
                    remaining_time = interval_seconds - time_diff
                    minutes = int(remaining_time // 60)
                    seconds = int(remaining_time % 60)
                    
                    return jsonify({
                        'success': False,
                        'error': 'API调用过于频繁',
                        'message': f'请等待 {minutes}分{seconds}秒 后再次调用',
                        'rate_limit': True,
                        'retry_after': remaining_time,
                        'next_available_time': (current_time + timedelta(seconds=remaining_time)).isoformat(),
                        'interval_minutes': api_interval_minutes
                    }), 429
            except (ValueError, TypeError):
                # 如果时间解析失败，允许继续执行
                pass
        
        # 记录API调用开始
        start_time = datetime.now()
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'API调用开始 - 爬虫: "{spider["name"]}"',
            source='api_call'
        )
        
        # 更新运行次数
        db.update_spider_stats(spider_id, increment_run=True)
        
        try:
            # 执行爬虫代码并获取结果
            result = spider_runner.execute_spider_api_call(spider_id, spider['code'])
            
            # 计算执行时间
            end_time = datetime.now()
            execution_time = (end_time - start_time).total_seconds()
            
            if result.get('success', False):
                # 成功情况
                db.create_log(
                    spider_id=spider_id,
                    level='INFO',
                    message=f'API调用成功 - 提取 {result.get("count", 0)} 条数据，耗时 {execution_time:.2f}秒',
                    source='api_call'
                )
                db.update_spider_stats(spider_id, increment_success=True)
                
                return jsonify({
                    'success': True,
                    'spider_id': spider_id,
                    'spider_name': spider['name'],
                    'data': result.get('data', []),
                    'count': result.get('count', 0),
                    'url': result.get('url', ''),
                    'execution_time': execution_time,
                    'timestamp': result.get('timestamp', start_time.timestamp()),
                    'message': f'成功提取 {result.get("count", 0)} 条数据'
                })
            else:
                # 失败情况
                error_msg = result.get('error', result.get('message', '未知错误'))
                db.create_log(
                    spider_id=spider_id,
                    level='ERROR',
                    message=f'API调用失败 - {error_msg}，耗时 {execution_time:.2f}秒',
                    source='api_call'
                )
                db.update_spider_stats(spider_id, increment_error=True)
                
                return jsonify({
                    'success': False,
                    'spider_id': spider_id,
                    'spider_name': spider['name'],
                    'data': [],
                    'count': 0,
                    'error': error_msg,
                    'execution_time': execution_time,
                    'timestamp': start_time.timestamp()
                }), 400
                
        except Exception as e:
            # 执行异常
            end_time = datetime.now()
            execution_time = (end_time - start_time).total_seconds()
            error_msg = f'爬虫执行异常: {str(e)}'
            
            db.create_log(
                spider_id=spider_id,
                level='ERROR',
                message=f'API调用异常 - {error_msg}，耗时 {execution_time:.2f}秒',
                source='api_call'
            )
            db.update_spider_stats(spider_id, increment_error=True)
            
            return jsonify({
                'success': False,
                'spider_id': spider_id,
                'spider_name': spider['name'],
                'data': [],
                'count': 0,
                'error': error_msg,
                'execution_time': execution_time,
                'timestamp': start_time.timestamp()
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500