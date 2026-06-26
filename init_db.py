import sqlite3
import os

def init_database():
    # Ensure the data directory exists
    if not os.path.exists("data"):
        os.makedirs("data")
        
    conn = sqlite3.connect("data/safety_system.db")
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password TEXT NOT NULL
    )
    """)
    
    # 2. Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY,
        auto_sos INTEGER DEFAULT 1,
        voice_sos INTEGER DEFAULT 1,
        language TEXT DEFAULT 'English',
        notifications INTEGER DEFAULT 1,
        dark_mode INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # 3. Contacts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # 4. Activity Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()
    print("Database Initialized Successfully: data/safety_system.db")

if __name__ == "__main__":
    init_database()
