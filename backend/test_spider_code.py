from database import Database
from utils.spider_runner import SpiderRunner

db = Database()
spider = db.get_spider(3)
runner = SpiderRunner()

if spider:
    execution_id = "test-execution-id"
    generated_code = runner._prepare_spider_code(spider, execution_id)
    
    print("Generated spider code:")
    print("=" * 50)
    print(generated_code)
    print("=" * 50)
    
    # 保存到文件以便检查
    with open('generated_spider_code.py', 'w', encoding='utf-8') as f:
        f.write(generated_code)
    
    print("Code saved to generated_spider_code.py")
else:
    print("Spider 3 not found")