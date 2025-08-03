import sqlite3
import json
import os
from datetime import datetime
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path='spider_management.db'):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """初始化数据库表"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 创建爬虫表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS spiders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    code TEXT NOT NULL,
                    status TEXT DEFAULT 'inactive',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_run_at TEXT,
                    run_count INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    config TEXT DEFAULT '{}'
                )
            ''')
            
            # 创建爬虫日志表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS spider_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    spider_id INTEGER NOT NULL,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    source TEXT,
                    execution_id TEXT,
                    FOREIGN KEY (spider_id) REFERENCES spiders (id) ON DELETE CASCADE
                )
            ''')
            
            # 创建爬虫文件表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS spider_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    spider_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_type TEXT,
                    file_size INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    description TEXT,
                    tags TEXT,
                    execution_id TEXT,
                    FOREIGN KEY (spider_id) REFERENCES spiders (id) ON DELETE CASCADE
                )
            ''')
            
            # 创建设置表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            logger.info("Database tables created successfully")
    
    @contextmanager
    def get_connection(self):
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 使结果可以通过列名访问
        try:
            yield conn
        finally:
            conn.close()
    
    # 爬虫相关操作
    def create_spider(self, name, description, code, config=None):
        """创建爬虫"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            config_json = json.dumps(config or {})
            cursor.execute('''
                INSERT INTO spiders (name, description, code, config)
                VALUES (?, ?, ?, ?)
            ''', (name, description, code, config_json))
            conn.commit()
            return cursor.lastrowid
    
    def get_spider(self, spider_id):
        """获取单个爬虫"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM spiders WHERE id = ?', (spider_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_all_spiders(self):
        """获取所有爬虫"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM spiders ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def update_spider(self, spider_id, **kwargs):
        """更新爬虫"""
        if not kwargs:
            return False
        
        # 添加更新时间
        kwargs['updated_at'] = datetime.now().isoformat()
        
        # 处理config字段
        if 'config' in kwargs and isinstance(kwargs['config'], dict):
            kwargs['config'] = json.dumps(kwargs['config'])
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 构建SET子句
            set_clause = ', '.join([f'{key} = ?' for key in kwargs.keys()])
            values = list(kwargs.values()) + [spider_id]
            
            cursor.execute(f'UPDATE spiders SET {set_clause} WHERE id = ?', values)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_spider(self, spider_id):
        """删除爬虫"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM spiders WHERE id = ?', (spider_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def update_spider_status(self, spider_id, status):
        """更新爬虫状态"""
        return self.update_spider(spider_id, status=status)
    
    def increment_spider_run_count(self, spider_id):
        """增加爬虫运行次数"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE spiders 
                SET run_count = run_count + 1, 
                    last_run_at = ?,
                    updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), datetime.now().isoformat(), spider_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def increment_spider_success_count(self, spider_id):
        """增加爬虫成功次数"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE spiders 
                SET success_count = success_count + 1,
                    updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), spider_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def increment_spider_error_count(self, spider_id):
        """增加爬虫错误次数"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE spiders 
                SET error_count = error_count + 1,
                    updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), spider_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def update_spider_stats(self, spider_id, increment_run=False, increment_success=False, increment_error=False):
        """更新爬虫统计信息"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            updates = []
            params = []
            
            if increment_run:
                updates.append('run_count = run_count + 1')
                updates.append('last_run_at = ?')
                params.append(datetime.now().isoformat())
            
            if increment_success:
                updates.append('success_count = success_count + 1')
            
            if increment_error:
                updates.append('error_count = error_count + 1')
            
            if updates:
                updates.append('updated_at = ?')
                params.append(datetime.now().isoformat())
                params.append(spider_id)
                
                sql = f'UPDATE spiders SET {', '.join(updates)} WHERE id = ?'
                cursor.execute(sql, params)
                conn.commit()
                return cursor.rowcount > 0
            
            return False
    
    # 日志相关操作
    def create_log(self, spider_id, level, message, source=None, execution_id=None):
        """创建日志"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO spider_logs (spider_id, level, message, source, execution_id)
                VALUES (?, ?, ?, ?, ?)
            ''', (spider_id, level, message, source, execution_id))
            conn.commit()
            return cursor.lastrowid
    
    def get_spider_logs(self, spider_id, limit=100, offset=0):
        """获取爬虫日志"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM spider_logs 
                WHERE spider_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ? OFFSET ?
            ''', (spider_id, limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def get_all_logs(self, limit=100, offset=0):
        """获取所有日志"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT l.*, s.name as spider_name 
                FROM spider_logs l 
                LEFT JOIN spiders s ON l.spider_id = s.id 
                ORDER BY l.timestamp DESC 
                LIMIT ? OFFSET ?
            ''', (limit, offset))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def delete_spider_logs(self, spider_id):
        """删除爬虫日志"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM spider_logs WHERE spider_id = ?', (spider_id,))
            conn.commit()
            return cursor.rowcount
    
    # 文件相关操作
    def create_file(self, spider_id, filename, file_path, file_type=None, description=None, execution_id=None):
        """创建文件记录"""
        file_size = 0
        if os.path.exists(file_path):
            file_size = os.path.getsize(file_path)
        
        if not file_type:
            ext = os.path.splitext(filename)[1].lower()
            type_mapping = {
                '.csv': 'csv', '.json': 'json', '.txt': 'text', '.log': 'log',
                '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
                '.pdf': 'pdf', '.xlsx': 'excel', '.xls': 'excel',
                '.html': 'html', '.xml': 'xml'
            }
            file_type = type_mapping.get(ext, 'unknown')
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO spider_files (spider_id, filename, file_path, file_type, file_size, description, execution_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (spider_id, filename, file_path, file_type, file_size, description, execution_id))
            conn.commit()
            return cursor.lastrowid
    
    def get_spider_files(self, spider_id):
        """获取爬虫文件"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM spider_files 
                WHERE spider_id = ? 
                ORDER BY created_at DESC
            ''', (spider_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def get_file(self, file_id):
        """获取单个文件"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM spider_files WHERE id = ?', (file_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_file_by_path(self, spider_id, file_path):
        """根据路径获取文件"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM spider_files WHERE spider_id = ? AND file_path = ?', (spider_id, file_path))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def delete_file(self, file_id):
        """删除文件记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM spider_files WHERE id = ?', (file_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_spider_files(self, spider_id):
        """删除爬虫文件"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM spider_files WHERE spider_id = ?', (spider_id,))
            conn.commit()
            return cursor.rowcount

# 全局数据库实例
db = Database()

def get_db():
    """获取数据库实例"""
    return db