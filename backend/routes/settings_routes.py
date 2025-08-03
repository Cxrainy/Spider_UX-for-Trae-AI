from flask import Blueprint, request, jsonify
from database import db
import json
from datetime import datetime

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/settings/profile', methods=['GET'])
def get_profile():
    """获取个人资料"""
    try:
        # 从数据库获取用户配置，这里使用简单的键值存储
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', ('profile',))
            result = cursor.fetchone()
        
        if result:
            profile = json.loads(result[0])
        else:
            # 默认配置
            profile = {
                'username': 'admin',
                'email': 'admin@example.com',
                'displayName': '管理员'
            }
            
        return jsonify(profile)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/profile', methods=['POST'])
def update_profile():
    """更新个人资料"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('username'):
            return jsonify({'error': 'Username is required'}), 400
        if not data.get('email'):
            return jsonify({'error': 'Email is required'}), 400
            
        profile_data = {
            'username': data['username'],
            'email': data['email'],
            'displayName': data.get('displayName', ''),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # 保存到数据库
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                ('profile', json.dumps(profile_data))
            )
            conn.commit()
        
        return jsonify({'message': 'Profile updated successfully', 'profile': profile_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/notifications', methods=['GET'])
def get_notifications():
    """获取通知设置"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', ('notifications',))
            result = cursor.fetchone()
        
        if result:
            notifications = json.loads(result[0])
        else:
            # 默认配置
            notifications = {
                'emailNotifications': True,
                'spiderSuccess': True,
                'spiderError': True,
                'systemUpdates': False
            }
            
        return jsonify(notifications)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/notifications', methods=['POST'])
def update_notifications():
    """更新通知设置"""
    try:
        data = request.get_json()
        
        notifications_data = {
            'emailNotifications': data.get('emailNotifications', True),
            'spiderSuccess': data.get('spiderSuccess', True),
            'spiderError': data.get('spiderError', True),
            'systemUpdates': data.get('systemUpdates', False),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # 保存到数据库
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                ('notifications', json.dumps(notifications_data))
            )
            conn.commit()
        
        return jsonify({'message': 'Notification settings updated successfully', 'notifications': notifications_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/system', methods=['GET'])
def get_system_settings():
    """获取系统设置"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', ('system',))
            result = cursor.fetchone()
        
        if result:
            system_settings = json.loads(result[0])
        else:
            # 默认配置
            system_settings = {
                'maxConcurrentSpiders': 3,
                'defaultTimeout': 30,
                'defaultRetries': 3,
                'logRetentionDays': 30,
                'fileRetentionDays': 90,
                'apiCallIntervalMinutes': 5
            }
            
        return jsonify(system_settings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/system', methods=['POST'])
def update_system_settings():
    """更新系统设置"""
    try:
        data = request.get_json()
        
        system_data = {
            'maxConcurrentSpiders': data.get('maxConcurrentSpiders', 3),
            'defaultTimeout': data.get('defaultTimeout', 30),
            'defaultRetries': data.get('defaultRetries', 3),
            'logRetentionDays': data.get('logRetentionDays', 30),
            'fileRetentionDays': data.get('fileRetentionDays', 90),
            'apiCallIntervalMinutes': data.get('apiCallIntervalMinutes', 5),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # 保存到数据库
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                ('system', json.dumps(system_data))
            )
            conn.commit()
        
        return jsonify({'message': 'System settings updated successfully', 'system': system_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/clear', methods=['POST'])
def clear_data():
    """清空数据"""
    try:
        data = request.get_json()
        clear_type = data.get('type', 'all')  # all, logs, files, spiders
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
             
            if clear_type == 'all' or clear_type == 'logs':
                cursor.execute('DELETE FROM spider_logs')
                
            if clear_type == 'all' or clear_type == 'files':
                cursor.execute('DELETE FROM spider_files')
                
            if clear_type == 'all' or clear_type == 'spiders':
                cursor.execute('DELETE FROM spiders')
                
            conn.commit()
             
        return jsonify({'message': f'Data cleared successfully: {clear_type}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/settings/export', methods=['GET'])
def export_data():
    """导出数据"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            
            # 获取所有爬虫数据
            cursor.execute('SELECT * FROM spiders')
            spiders_data = cursor.fetchall()
            spider_columns = [description[0] for description in cursor.description]
            spiders = [dict(zip(spider_columns, row)) for row in spiders_data]
            
            # 处理爬虫配置
            for spider in spiders:
                if spider.get('config'):
                    try:
                        spider['config'] = json.loads(spider['config'])
                    except:
                        spider['config'] = {}
            
            # 获取日志
            cursor.execute('SELECT * FROM spider_logs ORDER BY timestamp DESC LIMIT 1000')
            logs_data = cursor.fetchall()
            log_columns = [description[0] for description in cursor.description]
            logs = [dict(zip(log_columns, row)) for row in logs_data]
            
            # 获取文件
            cursor.execute('SELECT * FROM spider_files ORDER BY created_at DESC LIMIT 1000')
            files_data = cursor.fetchall()
            file_columns = [description[0] for description in cursor.description]
            files = [dict(zip(file_columns, row)) for row in files_data]
            
            # 获取设置
            cursor.execute('SELECT key, value FROM settings')
            settings_data = cursor.fetchall()
            settings = {}
            for setting in settings_data:
                try:
                    settings[setting[0]] = json.loads(setting[1])
                except:
                    settings[setting[0]] = setting[1]
        
        export_data = {
            'spiders': spiders,
            'logs': logs,
            'files': files,
            'settings': settings,
            'export_time': datetime.utcnow().isoformat(),
            'version': '1.0'
        }
        
        return jsonify(export_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500