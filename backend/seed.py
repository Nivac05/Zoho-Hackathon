import sqlite3
import uuid
from flask_bcrypt import Bcrypt
from database import get_db, init_db

bcrypt = Bcrypt()

def seed():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if already seeded
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        print("Database already seeded. Skipping.")
        conn.close()
        return

    print("Seeding initial data...")
    
    # 1. Users (Passwords: 'password123')
    pw_hash = bcrypt.generate_password_hash("password123").decode("utf-8")
    
    users = [
        ("u_driver", "Arun Kumar", "driver1", "driver@chive.com", pw_hash, "driver", 1500.0),
        ("u_lender", "Sundar Rajan", "lender1", "lender@chive.com", pw_hash, "lender", 500.0),
        ("u_driver2", "Priya Sharma", "driver2", "priya@chive.com", pw_hash, "driver", 2000.0)
    ]
    cursor.executemany("""
        INSERT INTO users (id, name, username, email, password_hash, role, wallet_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, users)

    # 2. Stations
    stations = [
        ("st_ecr", "lender1", "ECR Coastal EV Hub", "ECR", "East Coast Road, Thiruvanmiyur, Chennai", 12.8996, 80.2209, "CCS2 / Type 2", "50 kW Fast"),
        ("st_annanagar", "lender1", "Anna Nagar Green Charge", "Anna Nagar", "2nd Avenue, Roundtana, Anna Nagar, Chennai", 13.0850, 80.2101, "CCS2 Dual", "60 kW DC"),
        ("st_medavakkam", "lender1", "Medavakkam Eco Charge", "Medavakkam", "Velachery Main Rd, Medavakkam, Chennai", 12.9171, 80.1923, "Type 2 AC", "22 kW AC"),
        ("st_pammal", "lender1", "Pammal Express Charger", "Pammal", "Pammal Main Road, Chennai", 12.9691, 80.1374, "CCS2", "50 kW Fast"),
        ("st_maduravoyal", "lender1", "Maduravoyal Super Station", "Maduravoyal", "Poonamallee High Rd, Maduravoyal, Chennai", 13.0645, 80.1652, "DC Supercharger", "120 kW")
    ]
    cursor.executemany("""
        INSERT INTO stations (id, owner_username, name, location, address, lat, lng, connector, power)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, stations)

    # 3. Plugs
    plugs = [
        # ECR
        ("pl_ecr_1", "st_ecr", "Plug A (DC Fast)", "CCS2", "50 kW", "AVAILABLE", 6, 23),
        ("pl_ecr_2", "st_ecr", "Plug B (AC Standard)", "Type 2", "22 kW", "AVAILABLE", 6, 23),
        # Anna Nagar
        ("pl_an_1", "st_annanagar", "Port 1 (DC Ultra)", "CCS2", "60 kW", "AVAILABLE", 0, 24),
        ("pl_an_2", "st_annanagar", "Port 2 (DC Ultra)", "CCS2", "60 kW", "AVAILABLE", 0, 24),
        # Medavakkam
        ("pl_med_1", "st_medavakkam", "Main Bay AC", "Type 2", "22 kW", "AVAILABLE", 6, 22),
        # Pammal
        ("pl_pam_1", "st_pammal", "Fast Port Alpha", "CCS2", "50 kW", "AVAILABLE", 6, 23),
        # Maduravoyal
        ("pl_mad_1", "st_maduravoyal", "Supergun 1", "CCS2", "120 kW", "AVAILABLE", 0, 24),
        ("pl_mad_2", "st_maduravoyal", "Supergun 2", "CCS2", "120 kW", "AVAILABLE", 0, 24)
    ]
    cursor.executemany("""
        INSERT INTO plugs (id, station_id, name, connector, power, status, operating_start_hour, operating_end_hour)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, plugs)

    conn.commit()
    conn.close()
    print("Seed complete: 3 users, 5 stations, 8 plugs created.")

if __name__ == "__main__":
    seed()
