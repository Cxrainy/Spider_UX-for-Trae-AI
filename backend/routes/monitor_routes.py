from flask import Blueprint, jsonify
import psutil
import sqlite3
from datetime import datetime, timedelta
from database import get_db

monitor_bp = Blueprint('monitor', __name__)

@monitor_bp.route('/monitor/system', methods=['GET'])
def get_system_stats():
    """获取系统资源使用情况"""
    try:
        # 获取CPU使用率
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # 获取内存使用率
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        return jsonify({
            'success': True,
            'data': {
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'timestamp': datetime.now().isoformat()
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitor_bp.route('/monitor/spider-stats', methods=['GET'])
def get_spider_stats():
    """获取爬虫运行统计数据（按小时）"""
    try:
        db = get_db()
        
        # 获取过去24小时的数据
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=24)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # 按小时统计所有爬虫的运行次数（基于爬虫日志表）
            cursor.execute("""
                SELECT 
                    strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
                    COUNT(CASE WHEN level = 'INFO' AND message LIKE '%started%' THEN 1 END) as run_count,
                    COUNT(CASE WHEN level = 'INFO' AND message LIKE '%completed%' THEN 1 END) as success_count
                FROM spider_logs 
                WHERE timestamp >= ? AND timestamp <= ?
                    AND level IN ('INFO', 'ERROR')
                GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
                ORDER BY hour
            """, (start_time.isoformat(), end_time.isoformat()))
            
            hourly_stats = cursor.fetchall()
            
            # 计算总的运行次数和成功次数
            total_runs = sum(row[1] for row in hourly_stats)
            total_success = sum(row[2] for row in hourly_stats)
            overall_success_rate = (total_success / total_runs * 100) if total_runs > 0 else 0
            
            # 格式化数据
            stats_data = []
            for hour, run_count, success_count in hourly_stats:
                # 每小时的成功率仍然基于该小时的数据
                hourly_success_rate = (success_count / run_count * 100) if run_count > 0 else 0
                stats_data.append({
                    'hour': hour,
                    'run_count': run_count,
                    'success_count': success_count,
                    'success_rate': round(hourly_success_rate, 1)
                })
            
        return jsonify({
            'success': True,
            'data': stats_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@monitor_bp.route('/monitor/spider/<int:spider_id>/stats', methods=['GET'])
def get_single_spider_stats(spider_id):
    """获取单个爬虫的运行统计数据（按小时）"""
    try:
        db = get_db()
        
        # 获取过去24小时的数据
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=24)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # 按小时统计单个爬虫的运行次数
            cursor.execute("""
                SELECT 
                    strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
                    COUNT(CASE WHEN level = 'INFO' AND message LIKE '%started%' THEN 1 END) as run_count,
                    COUNT(CASE WHEN level = 'INFO' AND message LIKE '%completed%' THEN 1 END) as success_count
                FROM spider_logs 
                WHERE spider_id = ? AND timestamp >= ? AND timestamp <= ?
                    AND level IN ('INFO', 'ERROR')
                GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
                ORDER BY hour
            """, (spider_id, start_time.isoformat(), end_time.isoformat()))
            
            hourly_stats = cursor.fetchall()
            
            # 格式化数据
            stats_data = []
            for hour, run_count, success_count in hourly_stats:
                success_rate = (success_count / run_count * 100) if run_count > 0 else 0
                stats_data.append({
                    'hour': hour,
                    'run_count': run_count,
                    'success_count': success_count,
                    'success_rate': round(success_rate, 1)
                })
        
        return jsonify({
            'success': True,
            'data': stats_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500