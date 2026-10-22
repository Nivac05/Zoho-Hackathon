import sqlite3
import os
import threading
import uuid
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chive.db")
db_lock = threading.Lock()

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    with db_lock:
        conn = get_db()
        cursor = conn.cursor()
        
        # 1. Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('driver', 'lender')),
                wallet_balance REAL NOT NULL DEFAULT 1000.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. Stations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stations (
                id TEXT PRIMARY KEY,
                owner_username TEXT NOT NULL,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                address TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                connector TEXT NOT NULL,
                power TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 3. Plugs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plugs (
                id TEXT PRIMARY KEY,
                station_id TEXT NOT NULL,
                name TEXT NOT NULL,
                connector TEXT NOT NULL,
                power TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'MAINTENANCE')),
                operating_start_hour INTEGER NOT NULL DEFAULT 6,
                operating_end_hour INTEGER NOT NULL DEFAULT 23,
                FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
            )
        """)
        
        # 4. Slots table (Availability & Holds)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS slots (
                id TEXT PRIMARY KEY,
                station_id TEXT NOT NULL,
                plug_id TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_hours REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'HELD', 'BOOKED')),
                held_by TEXT,
                held_until TIMESTAMP,
                booking_id TEXT,
                quoted_price REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(plug_id, date, start_time)
            )
        """)
        
        # 5. Bookings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                user_username TEXT NOT NULL,
                station_id TEXT NOT NULL,
                station_name TEXT NOT NULL,
                plug_id TEXT NOT NULL,
                plug_name TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_hours REAL NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED', 'CANCELLED')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 6. Wallet Transactions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('DEBIT_BOOKING', 'CREDIT_EARNING', 'REFUND', 'TOPUP')),
                amount REAL NOT NULL,
                booking_id TEXT,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()

def release_expired_holds():
    """Releases any slot holds that have exceeded the 5-minute (300-second) threshold."""
    with db_lock:
        conn = get_db()
        cursor = conn.cursor()
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE slots 
            SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, quoted_price = NULL
            WHERE status = 'HELD' AND held_until < ?
        """, (now_str,))
        changed = cursor.rowcount
        conn.commit()
        conn.close()
        return changed

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
