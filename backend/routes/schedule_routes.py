from flask import Blueprint, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import json
from database import get_db

schedule_bp = Blueprint('schedule', __name__)

# 全局调度器实例（在app.py中初始化）
scheduler = None

def init_scheduler(app_scheduler):
    """初始化调度器"""
    global scheduler
    scheduler = app_scheduler

@schedule_bp.route('/spiders/<int:spider_id>/schedules', methods=['GET'])
def get_spider_schedules(spider_id):
    """获取爬虫的定时任务列表"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        # 从调度器获取该爬虫的任务
        jobs = []
        if scheduler:
            for job in scheduler.get_jobs():
                if job.id.startswith(f'spider_{spider_id}_'):
                    job_info = {
                        'id': job.id,
                        'name': job.name,
                        'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                        'trigger': str(job.trigger),
                        'args': job.args,
                        'kwargs': job.kwargs,
                        'misfire_grace_time': job.misfire_grace_time,
                        'max_instances': job.max_instances
                    }
                    jobs.append(job_info)
        
        return jsonify({
            'spider_id': spider_id,
            'schedules': jobs,
            'total': len(jobs)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/spiders/<int:spider_id>/schedules', methods=['POST'])
def create_schedule(spider_id):
    """创建定时任务"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
            
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Schedule name is required'}), 400
        
        if not data.get('trigger_type'):
            return jsonify({'error': 'Trigger type is required'}), 400
        
        # 生成任务ID
        job_id = f"spider_{spider_id}_{data['name'].replace(' ', '_')}"
        
        # 检查任务是否已存在
        if scheduler and scheduler.get_job(job_id):
            return jsonify({'error': 'Schedule with this name already exists'}), 400
        
        # 创建触发器
        trigger = _create_trigger(data)
        if not trigger:
            return jsonify({'error': 'Invalid trigger configuration'}), 400
        
        # 添加任务到调度器
        if scheduler:
            from utils.spider_runner import SpiderRunner
            spider_runner = SpiderRunner()
            
            job = scheduler.add_job(
                func=spider_runner.run_spider,
                trigger=trigger,
                args=[spider_id],  # 传递spider_id而不是spider对象
                id=job_id,
                name=data['name'],
                misfire_grace_time=data.get('misfire_grace_time', 30),
                max_instances=data.get('max_instances', 1),
                replace_existing=True
            )
            
            # 记录日志
            db.create_log(
                spider_id=spider_id,
                level='INFO',
                message=f'Schedule "{data["name"]}" created successfully',
                source='scheduler'
            )
            
            return jsonify({
                'message': 'Schedule created successfully',
                'job_id': job_id,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None
            }), 201
        else:
            return jsonify({'error': 'Scheduler not available'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/spiders/<int:spider_id>/schedules/<job_id>', methods=['GET'])
def get_schedule(spider_id, job_id):
    """获取单个定时任务详情"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        if not scheduler:
            return jsonify({'error': 'Scheduler not available'}), 500
        
        job = scheduler.get_job(job_id)
        if not job:
            return jsonify({'error': 'Schedule not found'}), 404
        
        # 验证任务属于该爬虫
        if not job.id.startswith(f'spider_{spider_id}_'):
            return jsonify({'error': 'Schedule not found'}), 404
        
        job_info = {
            'id': job.id,
            'name': job.name,
            'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
            'trigger': str(job.trigger),
            'trigger_type': type(job.trigger).__name__,
            'args': job.args,
            'kwargs': job.kwargs,
            'misfire_grace_time': job.misfire_grace_time,
            'max_instances': job.max_instances
        }
        
        return jsonify(job_info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/spiders/<int:spider_id>/schedules/<job_id>', methods=['PUT'])
def update_schedule(spider_id, job_id):
    """更新定时任务"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
            
        data = request.get_json()
        
        if not scheduler:
            return jsonify({'error': 'Scheduler not available'}), 500
        
        job = scheduler.get_job(job_id)
        if not job:
            return jsonify({'error': 'Schedule not found'}), 404
        
        # 验证任务属于该爬虫
        if not job.id.startswith(f'spider_{spider_id}_'):
            return jsonify({'error': 'Schedule not found'}), 404
        
        # 更新触发器
        if 'trigger_type' in data:
            trigger = _create_trigger(data)
            if trigger:
                job.reschedule(trigger=trigger)
        
        # 更新其他属性
        if 'name' in data:
            job.name = data['name']
        
        # 记录日志
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'Schedule "{job.name}" updated successfully',
            source='scheduler'
        )
        
        return jsonify({
            'message': 'Schedule updated successfully',
            'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/spiders/<int:spider_id>/schedules/<job_id>', methods=['DELETE'])
def delete_schedule(spider_id, job_id):
    """删除定时任务"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        if not scheduler:
            return jsonify({'error': 'Scheduler not available'}), 500
        
        job = scheduler.get_job(job_id)
        if not job:
            return jsonify({'error': 'Schedule not found'}), 404
        
        # 验证任务属于该爬虫
        if not job.id.startswith(f'spider_{spider_id}_'):
            return jsonify({'error': 'Schedule not found'}), 404
        
        job_name = job.name
        scheduler.remove_job(job_id)
        
        # 记录日志
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'Schedule "{job_name}" deleted successfully',
            source='scheduler'
        )
        
        return jsonify({'message': 'Schedule deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/spiders/<int:spider_id>/schedules/<job_id>/pause', methods=['POST'])
def pause_schedule(spider_id, job_id):
    """暂停定时任务"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        if not scheduler:
            return jsonify({'error': 'Scheduler not available'}), 500
        
        job = scheduler.get_job(job_id)
        if not job:
            return jsonify({'error': 'Schedule not found'}), 404
        
        # 验证任务属于该爬虫
        if not job.id.startswith(f'spider_{spider_id}_'):
            return jsonify({'error': 'Schedule not found'}), 404
        
        scheduler.pause_job(job_id)
        
        # 记录日志
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'Schedule "{job.name}" paused',
            source='scheduler'
        )
        
        return jsonify({'message': 'Schedule paused successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@schedule_bp.route('/spiders/<int:spider_id>/schedules/<job_id>/resume', methods=['POST'])
def resume_schedule(spider_id, job_id):
    """恢复定时任务"""
    try:
        db = get_db()
        spider = db.get_spider(spider_id)
        if not spider:
            return jsonify({'error': 'Spider not found'}), 404
        
        if not scheduler:
            return jsonify({'error': 'Scheduler not available'}), 500
        
        job = scheduler.get_job(job_id)
        if not job:
            return jsonify({'error': 'Schedule not found'}), 404
        
        # 验证任务属于该爬虫
        if not job.id.startswith(f'spider_{spider_id}_'):
            return jsonify({'error': 'Schedule not found'}), 404
        
        scheduler.resume_job(job_id)
        
        # 记录日志
        db.create_log(
            spider_id=spider_id,
            level='INFO',
            message=f'Schedule "{job.name}" resumed',
            source='scheduler'
        )
        
        return jsonify({
            'message': 'Schedule resumed successfully',
            'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _create_trigger(data):
    """根据配置创建触发器"""
    trigger_type = data.get('trigger_type')
    
    if trigger_type == 'cron':
        # Cron表达式触发器
        cron_config = data.get('cron_config', {})
        return CronTrigger(
            second=cron_config.get('second', '0'),
            minute=cron_config.get('minute', '*'),
            hour=cron_config.get('hour', '*'),
            day=cron_config.get('day', '*'),
            month=cron_config.get('month', '*'),
            day_of_week=cron_config.get('day_of_week', '*'),
            year=cron_config.get('year', '*'),
            timezone=cron_config.get('timezone', 'UTC')
        )
    
    elif trigger_type == 'interval':
        # 间隔触发器
        interval_config = data.get('interval_config', {})
        return IntervalTrigger(
            weeks=interval_config.get('weeks', 0),
            days=interval_config.get('days', 0),
            hours=interval_config.get('hours', 0),
            minutes=interval_config.get('minutes', 0),
            seconds=interval_config.get('seconds', 0)
        )
    
    return None