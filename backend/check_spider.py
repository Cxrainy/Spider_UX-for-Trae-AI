from database import Database

db = Database()
spider = db.get_spider(3)

print('Spider 3 Complete Info:')
print('Name:', spider['name'] if spider else 'No spider')
print('Status:', spider['status'] if spider else '')
print('\nComplete Code:')
print(spider['code'] if spider else 'No code')
print('\nConfig:')
print(spider['config'] if spider else 'No config')

print('\n' + '='*50)
print('Recent logs:')
logs = db.get_spider_logs(3, limit=5)
for log in logs:
    print(f"Time: {log['timestamp']}, Level: {log['level']}, Message: {log['message']}")