from flask import Flask, request, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
# SQLAlchemy jobstore removed - using in-memory storage
import os
import json
from datetime import datetime
import logging
import atexit
from database import db

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['JSON_AS_ASCII'] = False  # 确保JSON支持非ASCII字符

# 初始化扩展
CORS(app)

# 设置默认的JSON编码为UTF-8
@app.after_request
def after_request(response):
    if response.content_type.startswith('application/json'):
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response

# 配置调度器 - 使用内存存储替代SQLAlchemy
scheduler = BackgroundScheduler()
scheduler.start()

# 数据库操作现在通过database.py模块处理





# 导入路由
from routes.spider_routes import spider_bp
from routes.file_routes import file_bp
from routes.log_routes import log_bp
from routes.schedule_routes import schedule_bp
from routes.settings_routes import settings_bp
from routes.monitor_routes import monitor_bp

# 注册蓝图
app.register_blueprint(spider_bp, url_prefix='/api')
app.register_blueprint(file_bp, url_prefix='/api')
app.register_blueprint(log_bp, url_prefix='/api')
app.register_blueprint(schedule_bp, url_prefix='/api')
app.register_blueprint(settings_bp, url_prefix='/api')
app.register_blueprint(monitor_bp, url_prefix='/api')

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    import traceback
    error_details = traceback.format_exc()
    logger.error(f"Internal server error: {error_details}")
    return jsonify({
        'error': 'Internal server error',
        'details': error_details if app.debug else None
    }), 500

if __name__ == '__main__':
    # 数据库初始化已在database.py中处理
    logger.info("Database initialized successfully")
    
    # 创建必要的目录
    os.makedirs('spider_files', exist_ok=True)
    os.makedirs('spider_logs', exist_ok=True)
    
    logger.info("Starting Flask application...")
    app.run(debug=True, host='0.0.0.0', port=5000)