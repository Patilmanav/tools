import os
import pymysql
from datetime import datetime, timedelta
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()

def get_db_config():
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', '3306')),
        'user': os.getenv('DB_USER', 'user'),
        'password': os.getenv('DB_PASSWORD', 'password'),
        'db': os.getenv('DB_NAME', 'portfolio'),
        'charset': 'utf8mb4',
        'cursorclass': pymysql.cursors.DictCursor,
        'connect_timeout': 10,
        'read_timeout': 10,
        'write_timeout': 10
    }

def to_json_serializable(obj):
    if isinstance(obj, (datetime, )):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, (timedelta, )):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    return obj

class DatabaseManager:
    def __init__(self):
        self.config = get_db_config()

    def get_connection(self):
        return pymysql.connect(**self.config)

    def get_dashboard_stats(self):
        try:
            connection = self.get_connection()
            cursor = connection.cursor()
            today = datetime.now().date()
            yesterday = today - timedelta(days=1)

            # Today's stats
            cursor.execute("SELECT COUNT(DISTINCT id) as count FROM users WHERE DATE(last_visit) = %s", (today,))
            today_visitors = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(DISTINCT id) as count FROM users WHERE DATE(first_visit) = %s", (today,))
            today_new_visitors = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE DATE(created_at) = %s", (today,))
            today_operations = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE DATE(created_at) = %s AND status = 'success'", (today,))
            today_successful = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE DATE(created_at) = %s AND status = 'failed'", (today,))
            today_failed = cursor.fetchone()['count']

            cursor.execute("SELECT COALESCE(SUM(file_size), 0) as total FROM operations WHERE DATE(created_at) = %s", (today,))
            today_data_processed = cursor.fetchone()['total']

            # Yesterday's stats
            cursor.execute("SELECT COUNT(DISTINCT id) as count FROM users WHERE DATE(last_visit) = %s", (yesterday,))
            yesterday_visitors = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(DISTINCT id) as count FROM users WHERE DATE(first_visit) = %s", (yesterday,))
            yesterday_new_visitors = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE DATE(created_at) = %s", (yesterday,))
            yesterday_operations = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE DATE(created_at) = %s AND status = 'success'", (yesterday,))
            yesterday_successful = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE DATE(created_at) = %s AND status = 'failed'", (yesterday,))
            yesterday_failed = cursor.fetchone()['count']

            cursor.execute("SELECT COALESCE(SUM(file_size), 0) as total FROM operations WHERE DATE(created_at) = %s", (yesterday,))
            yesterday_data_processed = cursor.fetchone()['total']

            # Total stats
            cursor.execute("SELECT COUNT(DISTINCT id) as count FROM users")
            total_users = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations")
            total_operations = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE status = 'success'")
            total_successful = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM operations WHERE status = 'failed'")
            total_failed = cursor.fetchone()['count']

            cursor.execute("SELECT COALESCE(SUM(file_size), 0) as total FROM operations")
            total_data_processed = cursor.fetchone()['total']

            cursor.execute("SELECT COALESCE(AVG(processing_time_ms), 0) as avg_time FROM operations")
            avg_processing_time = cursor.fetchone()['avg_time']

            # Operation breakdown
            cursor.execute("""
                SELECT 
                    operation_type,
                    COUNT(*) as count,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                    COALESCE(AVG(processing_time_ms), 0) as avg_time
                FROM operations 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY operation_type
                ORDER BY count DESC
            """)
            operation_breakdown = []
            for row in cursor.fetchall():
                operation_breakdown.append({
                    'operation_type': row['operation_type'],
                    'count': row['count'],
                    'successful': row['successful'],
                    'failed': row['failed'],
                    'avg_time': float(row['avg_time']) if row['avg_time'] is not None else 0
                })

            # Recent operations
            cursor.execute("""
                SELECT 
                    o.operation_type,
                    o.status,
                    o.file_count,
                    o.processing_time_ms,
                    o.created_at,
                    u.session_id
                FROM operations o
                LEFT JOIN users u ON o.user_id = u.id
                ORDER BY o.created_at DESC
                LIMIT 10
            """)
            recent_operations = []
            for row in cursor.fetchall():
                recent_operations.append({
                    'operation_type': row['operation_type'],
                    'status': row['status'],
                    'file_count': row['file_count'],
                    'processing_time_ms': row['processing_time_ms'],
                    'created_at': to_json_serializable(row['created_at']),
                    'session_id': row['session_id']
                })

            connection.close()

            return {
                'today': {
                    'visitors': today_visitors,
                    'new_visitors': today_new_visitors,
                    'operations': today_operations,
                    'successful': today_successful,
                    'failed': today_failed,
                    'data_processed': today_data_processed
                },
                'yesterday': {
                    'visitors': yesterday_visitors,
                    'new_visitors': yesterday_new_visitors,
                    'operations': yesterday_operations,
                    'successful': yesterday_successful,
                    'failed': yesterday_failed,
                    'data_processed': yesterday_data_processed
                },
                'total': {
                    'users': total_users,
                    'operations': total_operations,
                    'successful': total_successful,
                    'failed': total_failed,
                    'data_processed': total_data_processed,
                    'avg_processing_time': float(avg_processing_time) if avg_processing_time is not None else 0
                },
                'operation_breakdown': operation_breakdown,
                'recent_operations': recent_operations
            }
        except Exception as e:
            print(f"Error in get_dashboard_stats: {e}")
            return {
                'today': {'visitors': 0, 'new_visitors': 0, 'operations': 0, 'successful': 0, 'failed': 0, 'data_processed': 0},
                'yesterday': {'visitors': 0, 'new_visitors': 0, 'operations': 0, 'successful': 0, 'failed': 0, 'data_processed': 0},
                'total': {'users': 0, 'operations': 0, 'successful': 0, 'failed': 0, 'data_processed': 0, 'avg_processing_time': 0},
                'operation_breakdown': [],
                'recent_operations': []
            }

db_manager = DatabaseManager() 