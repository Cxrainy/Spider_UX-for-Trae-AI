import threading
import subprocess
import time
import uuid
import os
import sys
from datetime import datetime
import tempfile
import json
from database import get_db

class SpiderRunner:
    """爬虫运行器"""
    
    def __init__(self):
        self.running_spiders = {}  # {spider_id: {'process': process, 'execution_id': id, 'start_time': time}}
        self.lock = threading.Lock()
    
    def run_spider(self, spider_id):
        """运行爬虫"""
        db = get_db()
        
        with self.lock:
            if spider_id in self.running_spiders:
                spider = db.get_spider(spider_id)
                raise Exception(f"Spider {spider['name'] if spider else spider_id} is already running")
            
            # 获取爬虫信息
            spider = db.get_spider(spider_id)
            if not spider:
                raise Exception(f"Spider {spider_id} not found")
            
            # 生成执行ID
            execution_id = str(uuid.uuid4())
            
            # 更新爬虫状态
            db.update_spider_status(spider_id, 'running')
            db.increment_spider_run_count(spider_id)
            
            # 记录开始日志
            db.create_log(
                spider_id=spider_id,
                level='INFO',
                message=f'Spider "{spider["name"]}" started with execution ID: {execution_id}',
                source='spider_runner',
                execution_id=execution_id
            )
            
            # 在新线程中运行爬虫
            thread = threading.Thread(
                target=self._execute_spider,
                args=(spider, execution_id)
            )
            thread.daemon = True
            thread.start()
            
            # 记录运行信息
            self.running_spiders[spider_id] = {
                'thread': thread,
                'execution_id': execution_id,
                'start_time': datetime.utcnow(),
                'status': 'running'
            }
            
            return execution_id
    
    def _execute_spider(self, spider, execution_id):
        """执行爬虫代码"""
        try:
            # 创建临时文件保存爬虫代码
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                # 添加必要的导入和工具函数
                spider_code = self._prepare_spider_code(spider, execution_id)
                f.write(spider_code)
                temp_file = f.name
            
            # 创建输出目录
            output_dir = os.path.join('spider_files', f'spider_{spider["id"]}', execution_id)
            os.makedirs(output_dir, exist_ok=True)
            
            # 设置环境变量
            env = os.environ.copy()
            env['SPIDER_ID'] = str(spider["id"])
            env['EXECUTION_ID'] = execution_id
            env['OUTPUT_DIR'] = output_dir
            
            # 运行爬虫
            process = subprocess.Popen(
                [sys.executable, temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=output_dir
            )
            
            # 更新进程信息
            with self.lock:
                if spider["id"] in self.running_spiders:
                    self.running_spiders[spider["id"]]['process'] = process
            
            # 等待进程完成
            stdout, stderr = process.communicate()
            
            # 处理输出
            self._handle_spider_output(spider, execution_id, stdout, stderr, process.returncode)
            
            # 清理临时文件
            try:
                os.unlink(temp_file)
            except:
                pass
            
        except Exception as e:
            import traceback
            error_details = f"{str(e)}\n\nFull traceback:\n{traceback.format_exc()}"
            self._handle_spider_error(spider, execution_id, error_details)
        finally:
            # 清理运行信息
            with self.lock:
                if spider["id"] in self.running_spiders:
                    del self.running_spiders[spider["id"]]
    
    def _prepare_spider_code(self, spider, execution_id):
        """准备爬虫代码"""
        # 添加工具函数和导入
        helper_code = f'''
import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path

# 爬虫运行环境变量
SPIDER_ID = {spider["id"]}
EXECUTION_ID = "{execution_id}"
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', '.')

# 工具函数
def log_message(level, message):
    """记录日志"""
    timestamp = datetime.now().isoformat()
    print(f"[{{{{{{timestamp}}}}}}] [{{{{{{level}}}}}}] {{{{{{message}}}}}}")

def save_data(data, filename, format='json'):
    """保存数据到文件"""
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        if format == 'json':
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        elif format == 'csv':
            import pandas as pd
            if isinstance(data, list) and len(data) > 0:
                df = pd.DataFrame(data)
                df.to_csv(filepath, index=False, encoding='utf-8')
            else:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(str(data))
        else:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(str(data))
        
        log_message('INFO', f'Data saved to {{{{filename}}}}')
        return filepath
    except Exception as e:
        log_message('ERROR', f'Failed to save data to {{{{filename}}}}: {{{{e}}}}')
        return None

def get_config():
    """获取爬虫配置"""
    return json.loads('{json.dumps(spider.get("config", {}))}')

# 用户爬虫代码开始
try:
    log_message('INFO', 'Spider execution started')
    
    # 用户代码开始
'''
        
        # 添加用户代码（需要正确缩进）
        user_code_lines = spider["code"].split('\n')
        indented_user_code = '\n'.join(['    ' + line if line.strip() else line for line in user_code_lines])
        user_code = indented_user_code
        
        # 添加异常处理结尾
        footer_code = '''
    
    log_message('INFO', 'Spider execution completed successfully')
except Exception as e:
    import traceback
    error_msg = f'Spider execution failed: {str(e)}'
    traceback_msg = traceback.format_exc()
    
    log_message('ERROR', error_msg)
    log_message('ERROR', f'Detailed traceback:\\n{traceback_msg}')
    
    # 输出到stderr以便被spider_runner捕获
    print(f'ERROR: {error_msg}', file=sys.stderr)
    print(f'TRACEBACK:\\n{traceback_msg}', file=sys.stderr)
    
    sys.exit(1)
'''
        
        return helper_code + user_code + footer_code
    
    def _handle_spider_output(self, spider, execution_id, stdout, stderr, return_code):
        """处理爬虫输出"""
        db = get_db()
        try:
            spider_id = spider["id"]
            spider_name = spider["name"]
            
            # 保存输出日志
            if stdout:
                self._save_output_log(spider_id, execution_id, 'stdout', stdout)
                # 将所有stdout内容作为运行日志记录
                stdout_lines = stdout.strip().split('\n')
                for line in stdout_lines:
                    line = line.strip()
                    if line:  # 只记录非空行
                        db.create_log(
                            spider_id=spider_id,
                            level='INFO',
                            message=line,
                            source='spider_output',
                            execution_id=execution_id
                        )
            
            if stderr:
                self._save_output_log(spider_id, execution_id, 'stderr', stderr)
                # 将所有stderr内容作为错误日志记录
                stderr_lines = stderr.strip().split('\n')
                for line in stderr_lines:
                    line = line.strip()
                    if line:  # 只记录非空行
                        db.create_log(
                            spider_id=spider_id,
                            level='ERROR',
                            message=line,
                            source='spider_error',
                            execution_id=execution_id
                        )
            
            # 更新爬虫状态
            if return_code == 0:
                db.update_spider_status(spider_id, 'inactive')
                db.increment_spider_success_count(spider_id)
                db.create_log(
                    spider_id=spider_id,
                    level='INFO',
                    message=f'Spider "{spider_name}" completed successfully',
                    source='spider_runner',
                    execution_id=execution_id
                )
            else:
                db.update_spider_status(spider_id, 'error')
                db.increment_spider_error_count(spider_id)
                db.create_log(
                    spider_id=spider_id,
                    level='ERROR',
                    message=f'Spider "{spider_name}" failed with exit code {return_code}',
                    source='spider_runner',
                    execution_id=execution_id
                )
            
            # 扫描输出文件
            self._scan_output_files(spider_id, execution_id)
            
        except Exception as e:
            print(f"Error handling spider output: {e}")
    
    def _handle_spider_error(self, spider, execution_id, error_message):
        """处理爬虫错误"""
        db = get_db()
        try:
            spider_id = spider["id"]
            spider_name = spider["name"]
            
            db.update_spider_status(spider_id, 'error')
            db.increment_spider_error_count(spider_id)
            
            # 记录详细的错误信息
            import traceback
            detailed_error = f'Spider "{spider_name}" execution failed:\n{error_message}'
            
            # 如果有异常堆栈，也记录下来
            if hasattr(error_message, '__traceback__'):
                detailed_error += f'\n\nTraceback:\n{traceback.format_exc()}'
            
            db.create_log(
                spider_id=spider_id,
                level='ERROR',
                message=detailed_error,
                source='spider_runner',
                execution_id=execution_id
            )
            
            # 同时在控制台输出错误信息
            print(f"Spider {spider_id} ({spider_name}) execution error: {error_message}")
            
        except Exception as e:
            print(f"Error handling spider error: {e}")
            import traceback
            print(traceback.format_exc())
    
    def _save_output_log(self, spider_id, execution_id, log_type, content):
        """保存输出日志到文件"""
        db = get_db()
        try:
            log_dir = os.path.join('spider_logs', f'spider_{spider_id}')
            os.makedirs(log_dir, exist_ok=True)
            
            log_file = os.path.join(log_dir, f'{execution_id}_{log_type}.log')
            with open(log_file, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # 创建文件记录
            db.create_file(
                spider_id=spider_id,
                filename=f'{execution_id}_{log_type}.log',
                file_path=log_file,
                file_type='log',
                description=f'Spider {log_type} output',
                execution_id=execution_id
            )
            
        except Exception as e:
            print(f"Error saving output log: {e}")
    
    def _parse_log_messages(self, spider_id, execution_id, output):
        """解析日志消息"""
        db = get_db()
        try:
            lines = output.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # 解析日志格式: [timestamp] [level] message
                if line.startswith('[') and '] [' in line:
                    try:
                        parts = line.split('] ', 2)
                        if len(parts) >= 3:
                            level = parts[1][1:]  # 移除开头的 [
                            message = parts[2]
                            
                            db.create_log(
                                spider_id=spider_id,
                                level=level,
                                message=message,
                                source='spider',
                                execution_id=execution_id
                            )
                    except:
                        pass
        except Exception as e:
            print(f"Error parsing log messages: {e}")
    
    def _scan_output_files(self, spider_id, execution_id):
        """扫描输出文件"""
        db = get_db()
        try:
            output_dir = os.path.join('spider_files', f'spider_{spider_id}', execution_id)
            if not os.path.exists(output_dir):
                return
            
            for root, dirs, files in os.walk(output_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, output_dir)
                    
                    # 检查是否已存在记录
                    existing = db.get_file_by_path(spider_id, file_path)
                    
                    if not existing:
                        db.create_file(
                            spider_id=spider_id,
                            filename=rel_path,
                            file_path=file_path,
                            description=f'Generated by spider execution {execution_id}',
                            execution_id=execution_id
                        )
        except Exception as e:
            print(f"Error scanning output files: {e}")
    
    def stop_spider(self, spider_id):
        """停止爬虫"""
        db = get_db()
        
        with self.lock:
            if spider_id not in self.running_spiders:
                raise Exception("Spider is not running")
            
            spider_info = self.running_spiders[spider_id]
            
            # 终止进程
            if 'process' in spider_info and spider_info['process']:
                try:
                    spider_info['process'].terminate()
                    # 等待进程结束
                    spider_info['process'].wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # 强制杀死进程
                    spider_info['process'].kill()
                except:
                    pass
            
            # 更新状态
            spider = db.get_spider(spider_id)
            if spider:
                db.update_spider_status(spider_id, 'stopped')
                
                db.create_log(
                    spider_id=spider_id,
                    level='WARNING',
                    message=f'Spider "{spider["name"]}" was stopped manually',
                    source='spider_runner',
                    execution_id=spider_info['execution_id']
                )
            
            # 清理运行信息
            del self.running_spiders[spider_id]
    
    def get_spider_status(self, spider_id):
        """获取爬虫运行状态"""
        with self.lock:
            if spider_id in self.running_spiders:
                spider_info = self.running_spiders[spider_id]
                return {
                    'is_running': True,
                    'execution_id': spider_info['execution_id'],
                    'start_time': spider_info['start_time'].isoformat(),
                    'duration': (datetime.utcnow() - spider_info['start_time']).total_seconds()
                }
            else:
                return {
                    'is_running': False
                }
    
    def get_all_running_spiders(self):
        """获取所有正在运行的爬虫"""
        with self.lock:
            return list(self.running_spiders.keys())
    
    def execute_spider_api_call(self, spider_id, spider_code):
        """执行爬虫API调用 - 直接返回数据而不保存文件"""
        try:
            # 创建临时文件保存爬虫代码
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                # 准备API调用版本的爬虫代码
                api_spider_code = self._prepare_api_spider_code(spider_code, spider_id)
                f.write(api_spider_code)
                temp_file = f.name
            
            # 设置环境变量
            env = os.environ.copy()
            env['SPIDER_ID'] = str(spider_id)
            env['API_CALL_MODE'] = 'true'
            
            # 运行爬虫
            process = subprocess.Popen(
                [sys.executable, temp_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            
            # 等待进程完成（带超时处理）
            try:
                stdout, stderr = process.communicate(timeout=300)  # 5分钟超时
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                raise subprocess.TimeoutExpired(process.args, 300)
            
            # 清理临时文件
            try:
                os.unlink(temp_file)
            except:
                pass
            
            # 处理结果
            if process.returncode == 0:
                # 尝试从stdout解析JSON结果
                try:
                    # 查找JSON输出（通常在最后一行）
                    lines = stdout.strip().split('\n')
                    result_json = None
                    
                    for line in reversed(lines):
                        line = line.strip()
                        if line.startswith('{') and line.endswith('}'):
                            try:
                                result_json = json.loads(line)
                                break
                            except:
                                continue
                    
                    if result_json:
                        return result_json
                    else:
                        # 如果没有找到JSON，返回默认失败结果
                        return {
                            'success': False,
                            'data': [],
                            'count': 0,
                            'error': '未找到有效的JSON输出',
                            'stdout': stdout,
                            'stderr': stderr
                        }
                        
                except Exception as e:
                    return {
                        'success': False,
                        'data': [],
                        'count': 0,
                        'error': f'解析输出失败: {str(e)}',
                        'stdout': stdout,
                        'stderr': stderr
                    }
            else:
                # 进程执行失败
                error_msg = stderr.strip() if stderr.strip() else '爬虫执行失败'
                return {
                    'success': False,
                    'data': [],
                    'count': 0,
                    'error': error_msg,
                    'stdout': stdout,
                    'stderr': stderr
                }
                
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'data': [],
                'count': 0,
                'error': '爬虫执行超时（超过5分钟）'
            }
        except Exception as e:
            return {
                'success': False,
                'data': [],
                'count': 0,
                'error': f'执行异常: {str(e)}'
            }
    
    def _prepare_api_spider_code(self, spider_code, spider_id):
        """准备API调用版本的爬虫代码"""
        # 获取爬虫配置
        from database import get_db
        db = get_db()
        spider = db.get_spider(spider_id)
        config = spider.get('config', {})
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except:
                config = {}
        
        # 检查是否为规则模式
        if config.get('type') == 'rules':
            return self._generate_rules_spider_code(config, spider_id)
        
        # API调用版本的辅助代码
        helper_code = f'''
import os
import sys
import json
import requests
from datetime import datetime
from bs4 import BeautifulSoup
import time

# 爬虫运行环境变量
SPIDER_ID = {spider_id}
API_CALL_MODE = True

# 全局变量用于存储API模式下的数据
_api_results = []

# 工具函数
def log_message(level, message):
    """记录日志"""
    timestamp = datetime.now().isoformat()
    print(f"[{{timestamp}}] [{{level}}] {{message}}", file=sys.stderr)

def get_config():
    """获取爬虫配置"""
    return {{}}

# 用户爬虫代码开始
try:
    log_message('INFO', 'API调用模式爬虫开始执行')
    
    # 执行用户代码并捕获返回值
'''
        
        # 添加用户代码（需要正确缩进）
        user_code_lines = spider_code.split('\n')
        indented_user_code = '\n'.join(['    ' + line if line.strip() else line for line in user_code_lines])
        
        # 在用户代码后重新定义save_data函数
        save_data_override = '''
    
    # 重新定义save_data函数以覆盖用户代码中的版本
    def save_data(data, filename, format='json'):
        """API模式下不保存文件，将数据存储到全局变量"""
        global _api_results
        _api_results = data if isinstance(data, list) else [data]
        log_message('INFO', f'数据准备完成，共 {{len(_api_results)}} 条记录')
        return _api_results
'''
        
        # 添加结果处理代码
        footer_code = '''
    
    # 如果spider_main函数存在，执行它
    if 'spider_main' in locals():
        # 执行spider_main函数
        spider_main()
        
        # 检查全局变量_api_results是否有数据
        if _api_results:
            # 输出成功结果到stdout
            print(json.dumps({
                'success': True,
                'data': _api_results,
                'count': len(_api_results),
                'url': locals().get('url', ''),
                'timestamp': datetime.now().timestamp(),
                'message': f'成功提取 {len(_api_results)} 条数据'
            }, ensure_ascii=False))
        else:
            # 如果没有数据，输出失败结果
            print(json.dumps({
                'success': False,
                'data': [],
                'count': 0,
                'message': '未提取到有效数据'
            }, ensure_ascii=False))
    else:
        # 如果没有spider_main函数，输出错误
        print(json.dumps({
            'success': False,
            'data': [],
            'count': 0,
            'error': '未找到spider_main函数'
        }, ensure_ascii=False))
    
    log_message('INFO', 'API调用模式爬虫执行完成')
    
except Exception as e:
    import traceback
    error_msg = f'爬虫执行失败: {str(e)}'
    traceback_msg = traceback.format_exc()
    
    log_message('ERROR', error_msg)
    log_message('ERROR', f'详细错误信息:\\n{traceback_msg}')
    
    # 输出错误结果到stdout
    print(json.dumps({
        'success': False,
        'data': [],
        'count': 0,
        'error': error_msg,
        'traceback': traceback_msg
    }, ensure_ascii=False))
    
    sys.exit(1)
'''
        
        return helper_code + indented_user_code + save_data_override + footer_code
    
    def _generate_rules_spider_code(self, config, spider_id):
        """根据规则配置生成爬虫代码"""
        import json
        
        url = config.get('url', '')
        rules = config.get('rules', [])
        headers = config.get('headers', {})
        delay = config.get('delay', 1)
        timeout = config.get('timeout', 30)
        retries = config.get('retries', 3)
        
        # 生成规则爬虫代码
        code = f'''
import os
import sys
import json
import requests
from datetime import datetime
from bs4 import BeautifulSoup
from lxml import html, etree
import time

# 爬虫运行环境变量
SPIDER_ID = {spider_id}
API_CALL_MODE = True

# 全局变量用于存储API模式下的数据
_api_results = []

# 工具函数
def log_message(level, message):
    """记录日志"""
    timestamp = datetime.now().isoformat()
    print(f"[{{timestamp}}] [{{level}}] {{message}}", file=sys.stderr)

def save_data(data, filename, format='json'):
    """API模式下不保存文件，将数据存储到全局变量"""
    global _api_results
    _api_results = data if isinstance(data, list) else [data]
    log_message('INFO', f'数据准备完成，共 {{len(_api_results)}} 条记录')
    return _api_results

def extract_data_by_rules(soup, tree, rules):
    """根据规则提取数据"""
    results = []
    
    # 找到所有可能的数据项
    # 先尝试用第一个规则找到所有匹配的元素作为基础
    if not rules:
        return results
    
    first_rule = rules[0]
    base_elements = []
    
    if first_rule.get('selectorType') == 'xpath':
        try:
            base_elements = tree.xpath(first_rule['selector'])
        except Exception as e:
            log_message('ERROR', f'XPath选择器错误: {{str(e)}}')
            return results
    else:
        try:
            base_elements = soup.select(first_rule['selector'])
        except Exception as e:
            log_message('ERROR', f'CSS选择器错误: {{str(e)}}')
            return results
    
    # 如果没有找到基础元素，尝试提取单个数据项
    if not base_elements:
        item = {{}}
        for rule in rules:
            field = rule.get('field', '')
            selector = rule.get('selector', '')
            selector_type = rule.get('selectorType', 'css')
            extract_type = rule.get('type', 'text')
            attr_name = rule.get('attr', '')
            
            if not field or not selector:
                continue
            
            try:
                if selector_type == 'xpath':
                    elements = tree.xpath(selector)
                    if elements:
                        element = elements[0]
                        if extract_type == 'text':
                            if hasattr(element, 'text_content'):
                                item[field] = element.text_content().strip()
                            else:
                                item[field] = str(element).strip()
                        elif extract_type == 'attr' and attr_name:
                            if hasattr(element, 'get'):
                                item[field] = element.get(attr_name, '')
                            else:
                                item[field] = ''
                        elif extract_type == 'html':
                            if hasattr(element, 'text_content'):
                                item[field] = etree.tostring(element, encoding='unicode')
                            else:
                                item[field] = str(element)
                else:
                    elements = soup.select(selector)
                    if elements:
                        element = elements[0]
                        if extract_type == 'text':
                            item[field] = element.get_text().strip()
                        elif extract_type == 'attr' and attr_name:
                            item[field] = element.get(attr_name, '')
                        elif extract_type == 'html':
                            item[field] = str(element)
            except Exception as e:
                log_message('ERROR', f'提取字段 {{field}} 时出错: {{str(e)}}')
                item[field] = ''
        
        if item:
            results.append(item)
    else:
        # 对每个基础元素提取所有字段
        for base_element in base_elements:
            item = {{}}
            
            for rule in rules:
                field = rule.get('field', '')
                selector = rule.get('selector', '')
                selector_type = rule.get('selectorType', 'css')
                extract_type = rule.get('type', 'text')
                attr_name = rule.get('attr', '')
                
                if not field or not selector:
                    continue
                
                try:
                    if selector_type == 'xpath':
                        # 对于XPath，在当前元素的上下文中查找
                        if hasattr(base_element, 'xpath'):
                            elements = base_element.xpath(selector)
                        else:
                            # 如果base_element不支持xpath，使用全局查找
                            elements = tree.xpath(selector)
                        
                        if elements:
                            element = elements[0]
                            if extract_type == 'text':
                                if hasattr(element, 'text_content'):
                                    item[field] = element.text_content().strip()
                                else:
                                    item[field] = str(element).strip()
                            elif extract_type == 'attr' and attr_name:
                                if hasattr(element, 'get'):
                                    item[field] = element.get(attr_name, '')
                                else:
                                    item[field] = ''
                            elif extract_type == 'html':
                                if hasattr(element, 'text_content'):
                                    item[field] = etree.tostring(element, encoding='unicode')
                                else:
                                    item[field] = str(element)
                    else:
                        # 对于CSS选择器，在当前元素的上下文中查找
                        elements = base_element.select(selector)
                        if not elements:
                            # 如果在当前元素中没找到，检查当前元素本身是否匹配
                            if base_element.select_one(selector.split()[-1]):
                                elements = [base_element]
                        
                        if elements:
                            element = elements[0]
                            if extract_type == 'text':
                                item[field] = element.get_text().strip()
                            elif extract_type == 'attr' and attr_name:
                                item[field] = element.get(attr_name, '')
                            elif extract_type == 'html':
                                item[field] = str(element)
                except Exception as e:
                    log_message('ERROR', f'提取字段 {{field}} 时出错: {{str(e)}}')
                    item[field] = ''
            
            if item:
                results.append(item)
    
    return results

def spider_main():
    """规则爬虫主函数"""
    url = "{url}"
    headers = {json.dumps(headers)}
    delay = {delay}
    timeout = {timeout}
    retries = {retries}
    rules = {json.dumps(rules)}
    
    log_message('INFO', f'开始爬取: {{url}}')
    
    # 请求网页
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            break
        except Exception as e:
            if attempt < retries:
                log_message('WARNING', f'请求失败，第{{attempt + 1}}次重试: {{str(e)}}')
                time.sleep(delay)
            else:
                log_message('ERROR', f'请求最终失败: {{str(e)}}')
                return []
    
    # 解析HTML
    try:
        soup = BeautifulSoup(response.text, 'html.parser')
        tree = html.fromstring(response.text)
        log_message('INFO', 'HTML解析完成')
    except Exception as e:
        log_message('ERROR', f'HTML解析失败: {{str(e)}}')
        return []
    
    # 根据规则提取数据
    try:
        results = extract_data_by_rules(soup, tree, rules)
        log_message('INFO', f'数据提取完成，共提取 {{len(results)}} 条记录')
        
        # 保存数据
        save_data(results, 'spider_results.json')
        return results
    except Exception as e:
        log_message('ERROR', f'数据提取失败: {{str(e)}}')
        return []

# 执行爬虫
try:
    log_message('INFO', '规则爬虫开始执行')
    
    # 执行spider_main函数
    results = spider_main()
    
    # 输出结果
    if results:
        print(json.dumps({{
            'success': True,
            'data': results,
            'count': len(results),
            'url': "{url}",
            'timestamp': datetime.now().timestamp(),
            'message': f'成功提取 {{len(results)}} 条数据'
        }}, ensure_ascii=False))
    else:
        print(json.dumps({{
            'success': False,
            'data': [],
            'count': 0,
            'message': '未提取到有效数据'
        }}, ensure_ascii=False))
    
    log_message('INFO', '规则爬虫执行完成')
    
except Exception as e:
    import traceback
    error_msg = f'规则爬虫执行失败: {{str(e)}}'
    traceback_msg = traceback.format_exc()
    
    log_message('ERROR', error_msg)
    log_message('ERROR', f'详细错误信息:\\n{{traceback_msg}}')
    
    # 输出错误结果到stdout
    print(json.dumps({{
        'success': False,
        'data': [],
        'count': 0,
        'error': error_msg,
        'traceback': traceback_msg
    }}, ensure_ascii=False))
    
    sys.exit(1)
'''
        
        return code