from flask import Blueprint, request, jsonify, Response
from datetime import datetime, timedelta
import json
import csv
import io
from database import Database

log_bp = Blueprint('log', __name__)

@log_bp.route('/spiders/<int:spider_id>/logs', methods=['GET'])
def get_spider_logs(spider_id):
    """获取爬虫日志"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        level = request.args.get('level')
        source = request.args.get('source')
        execution_id = request.args.get('execution_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search')
        
        # 构建查询条件
        conditions = ['spider_id = ?']
        params = [spider_id]
        
        if level:
            conditions.append('level = ?')
            params.append(level)
        
        if source:
            conditions.append('source = ?')
            params.append(source)
        
        if execution_id:
            conditions.append('execution_id = ?')
            params.append(execution_id)
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                conditions.append('timestamp >= ?')
                params.append(start_dt.isoformat())
            except ValueError:
                pass
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                conditions.append('timestamp <= ?')
                params.append(end_dt.isoformat())
            except ValueError:
                pass
        
        if search:
            conditions.append('message LIKE ?')
            params.append(f'%{search}%')
        
        where_clause = ' AND '.join(conditions)
        
        # 获取总数
        with db.get_connection() as conn:
            cursor = conn.cursor()
            count_query = f'SELECT COUNT(*) FROM spider_logs WHERE {where_clause}'
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]
        
        # 获取分页数据
        offset = (page - 1) * per_page
        query = f'''
            SELECT * FROM spider_logs 
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        '''
        params.extend([per_page, offset])
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            logs_data = cursor.fetchall()
        
        logs = []
        for log_data in logs_data:
            log_dict = dict(log_data)
            logs.append(log_dict)
        
        # 获取统计信息
        stats = _get_log_statistics(spider_id, start_date, end_date)
        
        return jsonify({
            'logs': logs,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            },
            'statistics': stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@log_bp.route('/spiders/<int:spider_id>/logs/<int:log_id>', methods=['GET'])
def get_log_detail(spider_id, log_id):
    """获取日志详情"""
    try:
        db = Database()
        log_data = db.get_spider_log(log_id)
        
        if not log_data or log_data['spider_id'] != spider_id:
            return jsonify({'error': 'Log not found'}), 404
        
        return jsonify(log_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@log_bp.route('/spiders/<int:spider_id>/logs', methods=['POST'])
def create_log(spider_id):
    """创建日志记录"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        data = request.get_json()
        
        if not data.get('level') or not data.get('message'):
            return jsonify({'error': 'Level and message are required'}), 400
        
        log_id = db.create_spider_log(
            spider_id=spider_id,
            level=data['level'],
            message=data['message'],
            source=data.get('source', 'user'),
            execution_id=data.get('execution_id')
        )
        
        # 获取创建的日志信息
        log_data = db.get_spider_log(log_id)
        
        return jsonify(log_data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@log_bp.route('/spiders/<int:spider_id>/logs/batch-delete', methods=['POST'])
def batch_delete_logs(spider_id):
    """批量删除日志"""
    try:
        db = Database()
        data = request.get_json()
        log_ids = data.get('log_ids', [])
        
        if not log_ids:
            return jsonify({'error': 'No log IDs provided'}), 400
        
        deleted_count = 0
        for log_id in log_ids:
            log_data = db.get_spider_log(log_id)
            if log_data and log_data['spider_id'] == spider_id:
                db.delete_spider_log(log_id)
                deleted_count += 1
        
        return jsonify({
            'message': f'{deleted_count} logs deleted successfully',
            'deleted_count': deleted_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@log_bp.route('/spiders/<int:spider_id>/logs/clear', methods=['POST'])
def clear_logs(spider_id):
    """清空日志"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        data = request.get_json()
        
        # 可选择保留最近N天的日志
        keep_days = data.get('keep_days', 0)
        
        if keep_days > 0:
            cutoff_date = datetime.utcnow() - timedelta(days=keep_days)
            query = 'DELETE FROM spider_logs WHERE spider_id = ? AND timestamp < ?'
            params = [spider_id, cutoff_date.isoformat()]
        else:
            query = 'DELETE FROM spider_logs WHERE spider_id = ?'
            params = [spider_id]
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            deleted_count = cursor.rowcount
            conn.commit()
        
        return jsonify({
            'message': f'{deleted_count} logs cleared successfully',
            'deleted_count': deleted_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@log_bp.route('/spiders/<int:spider_id>/logs/export', methods=['GET'])
def export_logs(spider_id):
    """导出日志"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 获取查询参数
        level = request.args.get('level')
        source = request.args.get('source')
        execution_id = request.args.get('execution_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        format_type = request.args.get('format', 'json')  # json, csv
        
        # 构建查询条件
        conditions = ['spider_id = ?']
        params = [spider_id]
        
        if level:
            conditions.append('level = ?')
            params.append(level)
        
        if source:
            conditions.append('source = ?')
            params.append(source)
        
        if execution_id:
            conditions.append('execution_id = ?')
            params.append(execution_id)
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                conditions.append('timestamp >= ?')
                params.append(start_dt.isoformat())
            except ValueError:
                pass
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                conditions.append('timestamp <= ?')
                params.append(end_dt.isoformat())
            except ValueError:
                pass
        
        where_clause = ' AND '.join(conditions)
        query = f'SELECT * FROM spider_logs WHERE {where_clause} ORDER BY timestamp DESC'
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            logs_data = cursor.fetchall()
        
        if format_type == 'csv':
            # CSV格式导出
            output = io.StringIO()
            writer = csv.writer(output)
            
            # 写入标题行
            writer.writerow(['ID', 'Level', 'Message', 'Timestamp', 'Source', 'Execution ID'])
            
            # 写入数据行
            for log_data in logs_data:
                log_dict = dict(log_data)
                writer.writerow([
                    log_dict['id'],
                    log_dict['level'],
                    log_dict['message'],
                    log_dict['timestamp'],
                    log_dict.get('source', ''),
                    log_dict.get('execution_id', '')
                ])
            
            output.seek(0)
            
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename=spider_{spider_id}_logs.csv'
                }
            )
        else:
            # JSON格式导出
            logs = []
            for log_data in logs_data:
                log_dict = dict(log_data)
                logs.append(log_dict)
            
            logs_export = {
                'spider_id': spider_id,
                'spider_name': spider['name'],
                'export_time': datetime.utcnow().isoformat(),
                'total_logs': len(logs),
                'logs': logs
            }
            
            return Response(
                json.dumps(logs_export, indent=2, ensure_ascii=False),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename=spider_{spider_id}_logs.json'
                }
            )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@log_bp.route('/spiders/<int:spider_id>/logs/statistics', methods=['GET'])
def get_log_statistics(spider_id):
    """获取日志统计信息"""
    try:
        db = Database()
        
        # 检查爬虫是否存在
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        stats = _get_log_statistics(spider_id, start_date, end_date)
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _get_log_statistics(spider_id, start_date='', end_date=''):
    """获取日志统计信息"""
    db = Database()
    
    # 构建基础查询条件
    conditions = ['spider_id = ?']
    params = [spider_id]
    
    # 日期范围过滤
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            conditions.append('timestamp >= ?')
            params.append(start_dt.isoformat())
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            conditions.append('timestamp <= ?')
            params.append(end_dt.isoformat())
        except ValueError:
            pass
    
    where_clause = ' AND '.join(conditions)
    
    # 总日志数
    with db.get_connection() as conn:
        cursor = conn.cursor()
        total_query = f'SELECT COUNT(*) FROM spider_logs WHERE {where_clause}'
        cursor.execute(total_query, params)
        total_logs = cursor.fetchone()[0]
    
    # 按级别统计
    with db.get_connection() as conn:
        cursor = conn.cursor()
        level_query = f'''
            SELECT level, COUNT(*) 
            FROM spider_logs 
            WHERE {where_clause}
            GROUP BY level
        '''
        cursor.execute(level_query, params)
        level_stats = cursor.fetchall()
    level_distribution = {level: count for level, count in level_stats}
    
    # 按来源统计
    with db.get_connection() as conn:
        cursor = conn.cursor()
        source_query = f'''
            SELECT source, COUNT(*) 
            FROM spider_logs 
            WHERE {where_clause}
            GROUP BY source
        '''
        cursor.execute(source_query, params)
        source_stats = cursor.fetchall()
    source_distribution = {source or 'unknown': count for source, count in source_stats}
    
    # 按日期统计（最近7天）
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_conditions = conditions + ['timestamp >= ?']
    daily_params = params + [seven_days_ago.isoformat()]
    daily_where_clause = ' AND '.join(daily_conditions)
    
    with db.get_connection() as conn:
        cursor = conn.cursor()
        daily_query = f'''
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM spider_logs 
            WHERE {daily_where_clause}
            GROUP BY DATE(timestamp)
            ORDER BY date
        '''
        cursor.execute(daily_query, daily_params)
        daily_stats = cursor.fetchall()
    daily_logs = [{
        'date': date,
        'count': count
    } for date, count in daily_stats]
    
    return {
        'total_logs': total_logs,
        'level_distribution': level_distribution,
        'source_distribution': source_distribution,
        'daily_logs': daily_logs
    }