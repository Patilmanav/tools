import os
from dotenv import load_dotenv
load_dotenv()

import pymysql
from datetime import datetime, timedelta
import json

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'user': os.getenv('DB_USER', 'user'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'db': os.getenv('DB_NAME', 'pdf_tools_db'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
    'connect_timeout': 10,
    'read_timeout': 10,
    'write_timeout': 10
}

def test_simple_query():
    """Test a simple query to see if we can get data"""
    print("🔍 Testing simple query...")
    connection = pymysql.connect(**DB_CONFIG)
    cursor = connection.cursor()
    
    try:
        # Simple count queries
        cursor.execute("SELECT COUNT(*) as user_count FROM users")
        user_count = cursor.fetchone()
        print(f"   Users: {user_count}")
        
        cursor.execute("SELECT COUNT(*) as op_count FROM operations")
        op_count = cursor.fetchall()
        print(f"   Operations: {op_count}")
        
        cursor.execute("SELECT COUNT(*) as stats_count FROM daily_stats")
        stats_count = cursor.fetchone()
        print(f"   Daily stats: {stats_count}")
        
        connection.close()
        return True
    except Exception as e:
        print(f"   Error: {e}")
        connection.close()
        return False

def test_dashboard_query_step_by_step():
    """Test the dashboard query step by step"""
    print("\n🔍 Testing dashboard query step by step...")
    connection = pymysql.connect(**DB_CONFIG)
    cursor = connection.cursor()
    
    try:
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        
        print(f"   Today: {today}, Yesterday: {yesterday}")
        
        # Test 1: Count users who visited today
        cursor.execute("""
            SELECT COUNT(DISTINCT u.id) as today_visitors
            FROM users u
            WHERE DATE(u.last_visit) = %s
        """, (today,))
        result1 = cursor.fetchone()
        print(f"   Today's visitors: {result1}")
        
        # Test 2: Count operations today
        cursor.execute("""
            SELECT COUNT(*) as today_operations
            FROM operations o
            WHERE DATE(o.created_at) = %s
        """, (today,))
        result2 = cursor.fetchone()
        print(f"   Today's operations: {result2}")
        
        # Test 3: Count total users
        cursor.execute("SELECT COUNT(DISTINCT u.id) as total_users FROM users u")
        result3 = cursor.fetchone()
        print(f"   Total users: {result3}")
        
        # Test 4: Count total operations
        cursor.execute("SELECT COUNT(*) as total_operations FROM operations")
        result4 = cursor.fetchone()
        print(f"   Total operations: {result4}")
        
        # Test 5: Get some recent operations
        cursor.execute("""
            SELECT o.operation_type, o.status, o.created_at
            FROM operations o
            ORDER BY o.created_at DESC
            LIMIT 3
        """)
        result5 = cursor.fetchall()
        print(f"   Recent operations: {result5}")
        
        connection.close()
        return True
    except Exception as e:
        print(f"   Error: {e}")
        import traceback
        traceback.print_exc()
        connection.close()
        return False

def test_json_serialization():
    """Test JSON serialization of the data"""
    print("\n🔍 Testing JSON serialization...")
    connection = pymysql.connect(**DB_CONFIG)
    cursor = connection.cursor()
    
    try:
        # Get some sample data
        cursor.execute("""
            SELECT o.operation_type, o.status, o.created_at, o.processing_time_ms
            FROM operations o
            ORDER BY o.created_at DESC
            LIMIT 2
        """)
        operations = cursor.fetchall()
        
        print(f"   Raw operations data: {operations}")
        
        # Try to serialize
        try:
            json_str = json.dumps(operations, default=str)
            print(f"   JSON serialization successful: {json_str[:200]}...")
            return True
        except Exception as e:
            print(f"   JSON serialization failed: {e}")
            return False
            
    except Exception as e:
        print(f"   Error: {e}")
        connection.close()
        return False
    finally:
        connection.close()

def main():
    print("🚀 Dashboard Debug Script")
    print("=" * 50)
    
    # Test 1: Simple queries
    if not test_simple_query():
        print("❌ Simple queries failed")
        return
    
    # Test 2: Step by step dashboard query
    if not test_dashboard_query_step_by_step():
        print("❌ Dashboard query failed")
        return
    
    # Test 3: JSON serialization
    if not test_json_serialization():
        print("❌ JSON serialization failed")
        return
    
    print("\n✅ All tests passed!")
    print("   The issue might be in the complex JOIN query or date handling.")

if __name__ == "__main__":
    main() 