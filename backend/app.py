import os
import sys
import time
import json
import uuid
import datetime
import threading
import queue
import sqlite3

# Ensure UTF-8 output on Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import torch
import torch.nn as nn
import numpy as np
import joblib
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)
from database import get_db, init_db, release_expired_holds, db_lock

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
bcrypt = Bcrypt(app)

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "c-hive-super-secure-jwt-secret-key-2026")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(days=7)
jwt = JWTManager(app)

CORS(app, origins="*", resources={r"/api/*": {"origins": "*"}})

# SSE Event Broadcaster (Pub/Sub)
sse_subscribers = []
sse_lock = threading.Lock()

def broadcast_slot_update(event_type, slot_data):
    """Pushes a real-time event to all connected SSE clients."""
    with sse_lock:
        dead_clients = []
        payload = json.dumps({"type": event_type, "data": slot_data, "timestamp": time.time()})
        msg = f"event: slot_change\ndata: {payload}\n\n"
        for q in sse_subscribers:
            try:
                q.put_nowait(msg)
            except Exception:
                dead_clients.append(q)
        for dead in dead_clients:
            sse_subscribers.remove(dead)

# Background timer to periodically release expired holds (every 10s)
def hold_cleanup_worker():
    while True:
        try:
            released_count = release_expired_holds()
            if released_count > 0:
                broadcast_slot_update("HOLDS_EXPIRED", {"released_count": released_count})
        except Exception as e:
            pass
        time.sleep(10)

cleanup_thread = threading.Thread(target=hold_cleanup_worker, daemon=True)
cleanup_thread.start()

# --- AI MODEL (PyTorch DQN) SETUP ---
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

class DQN(nn.Module):
    def __init__(self, input_dim, output_dim):
        super(DQN, self).__init__()
        self.fc1 = nn.Linear(input_dim, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, output_dim)

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)

dqn_model = None
scaler = None
max_price = 300.0

def load_ai_artifacts():
    global dqn_model, scaler, max_price
    try:
        model_path = os.path.join(ARTIFACTS_DIR, "dqn_model.pth")
        scaler_path = os.path.join(ARTIFACTS_DIR, "scaler.pkl")
        max_p_path = os.path.join(ARTIFACTS_DIR, "max_price.npy")
        
        if os.path.exists(model_path):
            dqn_model = DQN(input_dim=5, output_dim=1)
            dqn_model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
            dqn_model.eval()
            print("✅ PyTorch DQN model loaded.")
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
            print("✅ Scaler loaded.")
        if os.path.exists(max_p_path):
            max_price = float(np.load(max_p_path))
    except Exception as e:
        print(f"⚠️ Notice: DQN Model running in fallback mode: {e}")

load_ai_artifacts()

LOCATION_MAP = {"ECR": 0, "Anna Nagar": 1, "Medavakkam": 2, "Pammal": 3, "Maduravoyal": 4}

def calculate_canonical_price(location, start_hour, end_hour, duration, day_of_week):
    """Calculates canonical AI price estimate on the backend (never trusts frontend prices)."""
    try:
        loc_val = LOCATION_MAP.get(location, 0)
        start_h = int(start_hour)
        end_h = int(end_hour)
        dur = float(duration)
        day_w = int(day_of_week)
        
        if dqn_model is not None and scaler is not None:
            sample_input = np.array([[loc_val, start_h, end_h, dur, day_w]])
            sample_scaled = scaler.transform(sample_input)
            tensor = torch.tensor(sample_scaled, dtype=torch.float32)
            with torch.no_grad():
                predicted = dqn_model(tensor).item() * max_price / 3000
                calculated = max(40.0, float(predicted))
        else:
            base_hourly = 85.0
            if 0 <= start_h <= 6:
                base_hourly *= 0.75
            elif 18 <= start_h <= 21:
                base_hourly *= 1.35
            calculated = base_hourly * dur
        
        # Determine explanation
        if 0 <= start_h <= 6:
            reason = "Night-time off-peak discount applied (Low Grid Demand)."
        elif 10 <= start_h <= 16:
            reason = "Mid-day solar surge discount (Renewable Energy peak)."
        elif 18 <= start_h <= 21:
            reason = "Evening peak demand surge (High local grid load)."
        else:
            reason = "Standard dynamic EV charging rate applied."
            
        return round(calculated, 2), reason
    except Exception:
        return round(float(duration) * 80.0, 2), "Standard dynamic EV charging rate applied."

# =========================================================================
# 1. AUTHENTICATION (Sign Up, Log In, Log Out)
# =========================================================================

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip().lower()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "driver").lower()

    if not name or not username or not email or not password:
        return jsonify({"success": False, "error": "All fields (name, username, email, password) are required."}), 400

    if role not in ("driver", "lender"):
        return jsonify({"success": False, "error": "Role must be either 'driver' or 'lender'."}), 400

    if len(password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters long."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT username, email FROM users WHERE username = ? OR email = ?", (username, email))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        if existing["username"] == username:
            return jsonify({"success": False, "error": "Username already taken. Please choose another."}), 409
        return jsonify({"success": False, "error": "Email is already registered. Please log in."}), 409

    pw_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user_id = str(uuid.uuid4())
    initial_wallet = 1000.0 if role == "driver" else 500.0

    cursor.execute("""
        INSERT INTO users (id, name, username, email, password_hash, role, wallet_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, username, email, pw_hash, role, initial_wallet))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Welcome {name}! Your {role.capitalize()} account was created successfully."
    }), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("username") or data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"success": False, "error": "Invalid username or password."}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, username, email, password_hash, role, wallet_balance 
        FROM users 
        WHERE username = ? OR email = ?
    """, (identifier, identifier))
    user = cursor.fetchone()
    conn.close()

    # Generic error without revealing which field was wrong
    if not user or not bcrypt.check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "error": "Invalid username or password."}), 401

    token = create_access_token(
        identity=user["username"],
        additional_claims={
            "role": user["role"],
            "name": user["name"],
            "email": user["email"]
        }
    )

    return jsonify({
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "wallet_balance": float(user["wallet_balance"])
        }
    }), 200

# =========================================================================
# 2. STATIONS & PLUGS BROWSING
# =========================================================================

@app.route("/api/stations", methods=["GET"])
def get_stations():
    location = request.args.get("location")
    connector = request.args.get("connector")
    power = request.args.get("power")

    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM stations WHERE 1=1"
    params = []

    if location and location != "All":
        query += " AND location = ?"
        params.append(location)
    if connector and connector != "All":
        query += " AND connector LIKE ?"
        params.append(f"%{connector}%")
    if power and power != "All":
        query += " AND power LIKE ?"
        params.append(f"%{power}%")

    cursor.execute(query, params)
    rows = cursor.fetchall()

    stations = []
    for r in rows:
        st_id = r["id"]
        # Fetch plugs for station
        cursor.execute("SELECT * FROM plugs WHERE station_id = ?", (st_id,))
        plugs = [dict(p) for p in cursor.fetchall()]
        
        # Check overall station availability
        has_available_plug = any(p["status"] == "AVAILABLE" for p in plugs)

        st_dict = dict(r)
        st_dict["plugs"] = plugs
        st_dict["has_available"] = has_available_plug
        stations.append(st_dict)

    conn.close()
    return jsonify({"success": True, "stations": stations}), 200

@app.route("/api/stations/<station_id>", methods=["GET"])
def get_station_details(station_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM stations WHERE id = ?", (station_id,))
    station = cursor.fetchone()
    if not station:
        conn.close()
        return jsonify({"success": False, "error": "Charging station not found."}), 404

    cursor.execute("SELECT * FROM plugs WHERE station_id = ?", (station_id,))
    plugs = [dict(p) for p in cursor.fetchall()]
    conn.close()

    res = dict(station)
    res["plugs"] = plugs
    return jsonify({"success": True, "station": res}), 200

# =========================================================================
# 3. CHARGING-SLOT AVAILABILITY & REAL-TIME STATUS
# =========================================================================

@app.route("/api/stations/<station_id>/availability", methods=["GET"])
def get_station_availability(station_id):
    release_expired_holds()
    target_date = request.args.get("date") or datetime.date.today().isoformat()
    now_utc = datetime.datetime.utcnow()
    current_hour = datetime.datetime.now().hour
    is_today = (target_date == datetime.date.today().isoformat())

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM stations WHERE id = ?", (station_id,))
    station = cursor.fetchone()
    if not station:
        conn.close()
        return jsonify({"success": False, "error": "Station not found"}), 404

    cursor.execute("SELECT * FROM plugs WHERE station_id = ?", (station_id,))
    plugs = [dict(p) for p in cursor.fetchall()]

    cursor.execute("""
        SELECT * FROM slots 
        WHERE station_id = ? AND date = ?
    """, (station_id, target_date))
    db_slots = {f"{s['plug_id']}_{s['start_time']}": dict(s) for s in cursor.fetchall()}
    conn.close()

    plugs_availability = []
    for plug in plugs:
        p_id = plug["id"]
        start_op = plug["operating_start_hour"]
        end_op = plug["operating_end_hour"]
        plug_maintenance = (plug["status"] == "MAINTENANCE")

        slots = []
        for h in range(start_op, min(24, end_op)):
            st_str = f"{h:02d}:00"
            end_str = f"{(h+1):02d}:00"
            slot_key = f"{p_id}_{st_str}"
            db_slot = db_slots.get(slot_key)

            is_past = is_today and (h < current_hour)
            
            if plug_maintenance:
                status = "MAINTENANCE"
                held_by = None
                remaining_seconds = 0
            elif is_past:
                status = "PAST"
                held_by = None
                remaining_seconds = 0
            elif db_slot:
                status = db_slot["status"]
                held_by = db_slot["held_by"]
                if status == "HELD" and db_slot["held_until"]:
                    try:
                        held_dt = datetime.datetime.strptime(db_slot["held_until"], "%Y-%m-%d %H:%M:%S")
                        remaining_seconds = max(0, int((held_dt - now_utc).total_seconds()))
                    except Exception:
                        remaining_seconds = 0
                else:
                    remaining_seconds = 0
            else:
                status = "AVAILABLE"
                held_by = None
                remaining_seconds = 0

            slots.append({
                "slot_id": db_slot["id"] if db_slot else f"slot_{p_id}_{target_date}_{st_str}",
                "plug_id": p_id,
                "date": target_date,
                "start_time": st_str,
                "end_time": end_str,
                "hour": h,
                "status": status,
                "held_by": held_by,
                "remaining_seconds": remaining_seconds,
                "can_book": (status == "AVAILABLE")
            })

        plugs_availability.append({
            "plug": plug,
            "slots": slots
        })

    return jsonify({
        "success": True,
        "station_id": station_id,
        "date": target_date,
        "plugs": plugs_availability
    }), 200

# =========================================================================
# 4. AI DYNAMIC PRICING ESTIMATION
# =========================================================================

@app.route("/api/predict", methods=["POST"])
def get_prediction():
    data = request.get_json(silent=True) or {}
    location = data.get("location") or "ECR"
    start_hour = data.get("start_hour")
    end_hour = data.get("end_hour")
    duration = data.get("charging_duration")
    day_of_week = data.get("day_of_week", datetime.datetime.now().weekday())

    if start_hour is None or end_hour is None or duration is None:
        return jsonify({"success": False, "error": "start_hour, end_hour and charging_duration are required."}), 400

    try:
        sh = int(start_hour)
        eh = int(end_hour)
        dur = float(duration)
        if dur <= 0 or dur > 8:
            return jsonify({"success": False, "error": "Charging duration must be between 1 and 8 hours."}), 400
        if eh <= sh:
            return jsonify({"success": False, "error": "End time must be after start time."}), 400
    except ValueError:
        return jsonify({"success": False, "error": "Invalid hour or duration format."}), 400

    price, reason = calculate_canonical_price(location, sh, eh, dur, day_of_week)
    return jsonify({
        "success": True,
        "predicted_price": price,
        "reason": reason,
        "currency": "INR"
    }), 200

# =========================================================================
# 5. ATOMIC SLOT HOLD & PAYMENT CONFIRMATION (Concurrency Safe)
# =========================================================================

@app.route("/api/slots/hold", methods=["POST"])
@jwt_required()
def hold_slot():
    release_expired_holds()
    username = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    
    station_id = data.get("station_id")
    plug_id = data.get("plug_id")
    date_str = data.get("date") or datetime.date.today().isoformat()
    start_time = data.get("start_time")
    duration = float(data.get("duration", 1.0))
    location = data.get("location") or "ECR"

    if not station_id or not plug_id or not start_time:
        return jsonify({"success": False, "error": "Missing station_id, plug_id, or start_time."}), 400

    try:
        start_hour = int(start_time.split(":")[0])
        end_hour = start_hour + int(duration)
        end_time = f"{end_hour:02d}:00"
    except Exception:
        return jsonify({"success": False, "error": "Invalid start_time or duration."}), 400

    now_utc = datetime.datetime.utcnow()
    hold_until = (now_utc + datetime.timedelta(seconds=300)).strftime("%Y-%m-%d %H:%M:%S")

    # Canonical pricing calculated on backend
    canonical_price, reason = calculate_canonical_price(
        location, start_hour, end_hour, duration, datetime.datetime.now().weekday()
    )

    with db_lock:
        conn = get_db()
        cursor = conn.cursor()
        
        # Check plug operating hours & status
        cursor.execute("SELECT * FROM plugs WHERE id = ?", (plug_id,))
        plug = cursor.fetchone()
        if not plug:
            conn.close()
            return jsonify({"success": False, "error": "Charging plug does not exist."}), 404
        if plug["status"] == "MAINTENANCE":
            conn.close()
            return jsonify({"success": False, "error": "This plug is currently undergoing maintenance."}), 409
        if start_hour < plug["operating_start_hour"] or end_hour > plug["operating_end_hour"]:
            conn.close()
            return jsonify({"success": False, "error": "Requested interval is outside the plug's operating hours."}), 400

        # Concurrency Check: Check existing slot state
        cursor.execute("""
            SELECT * FROM slots 
            WHERE plug_id = ? AND date = ? AND start_time = ?
        """, (plug_id, date_str, start_time))
        existing = cursor.fetchone()

        now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S")

        if existing:
            # Overlapping hold or booked check
            if existing["status"] == "BOOKED":
                conn.close()
                return jsonify({
                    "success": False,
                    "error": "This slot has already been booked by another driver. Please pick another."
                }), 409

            if existing["status"] == "HELD" and existing["held_by"] != username and existing["held_until"] > now_str:
                conn.close()
                return jsonify({
                    "success": False,
                    "error": "This slot is currently held by another driver. Please try again after 5 minutes."
                }), 409

            slot_id = existing["id"]
            cursor.execute("""
                UPDATE slots 
                SET status = 'HELD', held_by = ?, held_until = ?, quoted_price = ?
                WHERE id = ?
            """, (username, hold_until, canonical_price, slot_id))
        else:
            slot_id = f"slot_{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO slots (id, station_id, plug_id, date, start_time, end_time, duration_hours, status, held_by, held_until, quoted_price)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'HELD', ?, ?, ?)
            """, (slot_id, station_id, plug_id, date_str, start_time, end_time, duration, username, hold_until, canonical_price))

        conn.commit()
        conn.close()

    # Broadcast real-time SSE event to all connected driver maps
    broadcast_slot_update("SLOT_HELD", {
        "station_id": station_id,
        "plug_id": plug_id,
        "date": date_str,
        "start_time": start_time,
        "status": "HELD",
        "held_by": username
    })

    return jsonify({
        "success": True,
        "message": "Slot held successfully for 5 minutes.",
        "slot_id": slot_id,
        "station_id": station_id,
        "plug_id": plug_id,
        "date": date_str,
        "start_time": start_time,
        "end_time": end_time,
        "duration": duration,
        "price": canonical_price,
        "price_reason": reason,
        "expires_in_seconds": 300,
        "held_until": hold_until
    }), 200

@app.route("/api/slots/confirm", methods=["POST"])
@jwt_required()
def confirm_booking():
    release_expired_holds()
    username = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    slot_id = data.get("slot_id")

    if not slot_id:
        return jsonify({"success": False, "error": "slot_id is required."}), 400

    now_str = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    with db_lock:
        conn = get_db()
        cursor = conn.cursor()

        # 1. Validate slot hold
        cursor.execute("SELECT * FROM slots WHERE id = ?", (slot_id,))
        slot = cursor.fetchone()
        if not slot:
            conn.close()
            return jsonify({"success": False, "error": "Slot reservation not found."}), 404

        if slot["status"] == "BOOKED":
            conn.close()
            return jsonify({"success": False, "error": "This slot has already been confirmed."}), 409

        if slot["status"] != "HELD" or slot["held_by"] != username or (slot["held_until"] and slot["held_until"] < now_str):
            conn.close()
            return jsonify({"success": False, "error": "Your hold on this slot has expired. Please reselect."}), 410

        amount = float(slot["quoted_price"])

        # 2. Check Driver balance
        cursor.execute("SELECT wallet_balance FROM users WHERE username = ?", (username,))
        driver = cursor.fetchone()
        if not driver or driver["wallet_balance"] < amount:
            conn.close()
            return jsonify({
                "success": False, 
                "error": f"Insufficient wallet balance (₹{driver['wallet_balance']:.2f} available, ₹{amount:.2f} required). Please top up."
            }), 402

        # 3. Find Lender
        cursor.execute("""
            SELECT s.owner_username, s.name as station_name, p.name as plug_name 
            FROM stations s 
            JOIN plugs p ON s.id = p.station_id 
            WHERE p.id = ?
        """, (slot["plug_id"],))
        station_info = cursor.fetchone()
        lender_username = station_info["owner_username"] if station_info else "lender1"
        station_name = station_info["station_name"] if station_info else "EV Hub"
        plug_name = station_info["plug_name"] if station_info else "Plug"

        booking_id = f"BK-{uuid.uuid4().hex[:6].upper()}"

        try:
            # Atomic transaction: Deduct Driver, Credit Lender, Insert Booking, Update Slot
            cursor.execute("UPDATE users SET wallet_balance = wallet_balance - ? WHERE username = ?", (amount, username))
            cursor.execute("UPDATE users SET wallet_balance = wallet_balance + ? WHERE username = ?", (amount, lender_username))
            
            cursor.execute("""
                INSERT INTO bookings (id, user_username, station_id, station_name, plug_id, plug_name, date, start_time, end_time, duration_hours, amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
            """, (booking_id, username, slot["station_id"], station_name, slot["plug_id"], plug_name, slot["date"], slot["start_time"], slot["end_time"], slot["duration_hours"], amount))

            cursor.execute("""
                UPDATE slots 
                SET status = 'BOOKED', booking_id = ?, held_until = NULL 
                WHERE id = ?
            """, (booking_id, slot_id))

            cursor.execute("""
                INSERT INTO wallet_transactions (id, username, type, amount, booking_id, description)
                VALUES (?, ?, 'DEBIT_BOOKING', ?, ?, ?)
            """, (str(uuid.uuid4()), username, amount, booking_id, f"Slot booking at {station_name} ({plug_name})"))

            cursor.execute("""
                INSERT INTO wallet_transactions (id, username, type, amount, booking_id, description)
                VALUES (?, ?, 'CREDIT_EARNING', ?, ?, ?)
            """, (str(uuid.uuid4()), lender_username, amount, booking_id, f"Slot booked by {username} at {station_name}"))

            # Fetch updated driver balance
            cursor.execute("SELECT wallet_balance FROM users WHERE username = ?", (username,))
            new_balance = cursor.fetchone()["wallet_balance"]

            conn.commit()
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({"success": False, "error": f"Booking failed during transaction: {str(e)}"}), 500

        conn.close()

    # Broadcast real-time slot update
    broadcast_slot_update("SLOT_BOOKED", {
        "station_id": slot["station_id"],
        "plug_id": slot["plug_id"],
        "date": slot["date"],
        "start_time": slot["start_time"],
        "status": "BOOKED",
        "booking_id": booking_id
    })

    return jsonify({
        "success": True,
        "message": "Charging slot booked and confirmed successfully!",
        "booking": {
            "booking_id": booking_id,
            "station": station_name,
            "plug": plug_name,
            "date": slot["date"],
            "start_time": slot["start_time"],
            "end_time": slot["end_time"],
            "duration": f"{slot['duration_hours']} Hour(s)",
            "amount": amount,
            "status": "CONFIRMED"
        },
        "new_balance": round(new_balance, 2)
    }), 200

# =========================================================================
# 6. MY BOOKINGS & WALLET
# =========================================================================

@app.route("/api/user/bookings", methods=["GET"])
@jwt_required()
def get_user_bookings():
    username = get_jwt_identity()
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM bookings 
        WHERE user_username = ? 
        ORDER BY date DESC, start_time DESC
    """, (username,))
    rows = cursor.fetchall()
    conn.close()

    now_date = datetime.date.today().isoformat()
    now_hour = datetime.datetime.now().strftime("%H:%M")

    upcoming = []
    past = []
    cancelled = []

    for r in rows:
        b = dict(r)
        if b["status"] == "CANCELLED":
            cancelled.append(b)
        elif b["date"] > now_date or (b["date"] == now_date and b["start_time"] >= now_hour):
            upcoming.append(b)
        else:
            past.append(b)

    return jsonify({
        "success": True,
        "upcoming": upcoming,
        "past": past,
        "cancelled": cancelled,
        "all_bookings": upcoming + past + cancelled
    }), 200

@app.route("/api/user/wallet", methods=["GET"])
@jwt_required()
def get_wallet():
    username = get_jwt_identity()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT wallet_balance FROM users WHERE username = ?", (username,))
    u = cursor.fetchone()
    balance = u["wallet_balance"] if u else 0.0

    cursor.execute("""
        SELECT * FROM wallet_transactions 
        WHERE username = ? 
        ORDER BY created_at DESC 
        LIMIT 50
    """, (username,))
    transactions = [dict(t) for t in cursor.fetchall()]
    conn.close()

    return jsonify({
        "success": True,
        "wallet_balance": round(balance, 2),
        "transactions": transactions
    }), 200

@app.route("/api/user/wallet/topup", methods=["POST"])
@jwt_required()
def topup_wallet():
    username = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    amount = float(data.get("amount", 500.0))
    if amount <= 0:
        return jsonify({"success": False, "error": "Top-up amount must be positive."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET wallet_balance = wallet_balance + ? WHERE username = ?", (amount, username))
    cursor.execute("""
        INSERT INTO wallet_transactions (id, username, type, amount, description)
        VALUES (?, ?, 'TOPUP', ?, ?)
    """, (str(uuid.uuid4()), username, amount, f"Wallet top-up via UPI / NetBanking"))
    cursor.execute("SELECT wallet_balance FROM users WHERE username = ?", (username,))
    new_bal = cursor.fetchone()["wallet_balance"]
    conn.commit()
    conn.close()

    return jsonify({"success": True, "wallet_balance": round(new_bal, 2)}), 200

# =========================================================================
# 7. LENDER MANAGEMENT (Stations & Plugs)
# =========================================================================

@app.route("/api/lenders/stations", methods=["POST"])
@jwt_required()
def add_lender_station():
    username = get_jwt_identity()
    claims = get_jwt()
    if claims.get("role") != "lender":
        return jsonify({"success": False, "error": "Access denied. Only Lenders can add stations."}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    location = (data.get("location") or "").strip()
    address = (data.get("address") or "").strip()
    lat = float(data.get("lat", 13.0827))
    lng = float(data.get("lng", 80.2707))
    connector = (data.get("connector") or "CCS2").strip()
    power = (data.get("power") or "50 kW").strip()

    if not name or not address:
        return jsonify({"success": False, "error": "Station name and address are required."}), 400

    station_id = f"st_{uuid.uuid4().hex[:8]}"
    plug_id = f"pl_{uuid.uuid4().hex[:8]}"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO stations (id, owner_username, name, location, address, lat, lng, connector, power)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (station_id, username, name, location, address, lat, lng, connector, power))

    cursor.execute("""
        INSERT INTO plugs (id, station_id, name, connector, power, status, operating_start_hour, operating_end_hour)
        VALUES (?, ?, 'Plug 1 (Primary)', ?, ?, 'AVAILABLE', 6, 23)
    """, (plug_id, station_id, connector, power))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Station registered successfully!", "station_id": station_id}), 201

@app.route("/api/lenders/mine", methods=["GET"])
@jwt_required()
def get_lender_stations():
    username = get_jwt_identity()
    claims = get_jwt()
    if claims.get("role") != "lender":
        return jsonify({"success": False, "error": "Access denied. Only Lenders can access this endpoint."}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM stations WHERE owner_username = ?", (username,))
    stations = []
    for s in cursor.fetchall():
        st_dict = dict(s)
        cursor.execute("SELECT * FROM plugs WHERE station_id = ?", (s["id"],))
        st_dict["plugs"] = [dict(p) for p in cursor.fetchall()]
        stations.append(st_dict)
    conn.close()

    return jsonify({"success": True, "stations": stations}), 200

@app.route("/api/lenders/plugs/<plug_id>/maintenance", methods=["PATCH"])
@jwt_required()
def toggle_plug_maintenance(plug_id):
    username = get_jwt_identity()
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify plug ownership
    cursor.execute("""
        SELECT p.*, s.owner_username 
        FROM plugs p 
        JOIN stations s ON p.station_id = s.id 
        WHERE p.id = ?
    """, (plug_id,))
    plug = cursor.fetchone()
    if not plug:
        conn.close()
        return jsonify({"success": False, "error": "Plug not found"}), 404
    if plug["owner_username"] != username:
        conn.close()
        return jsonify({"success": False, "error": "You can only manage your own stations."}), 403

    new_status = "MAINTENANCE" if plug["status"] == "AVAILABLE" else "AVAILABLE"
    cursor.execute("UPDATE plugs SET status = ? WHERE id = ?", (new_status, plug_id))
    conn.commit()
    conn.close()

    broadcast_slot_update("PLUG_STATUS_CHANGE", {"plug_id": plug_id, "status": new_status})
    return jsonify({"success": True, "status": new_status, "message": f"Plug status updated to {new_status}"}), 200

# =========================================================================
# 8. BONUS: CANCEL CHARGING BOOKING & ATOMIC REFUND
# =========================================================================

@app.route("/api/bookings/<booking_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_booking(booking_id):
    username = get_jwt_identity()
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    booking = cursor.fetchone()
    if not booking:
        conn.close()
        return jsonify({"success": False, "error": "Booking not found."}), 404

    if booking["user_username"] != username:
        conn.close()
        return jsonify({"success": False, "error": "You can only cancel your own bookings."}), 403

    if booking["status"] == "CANCELLED":
        conn.close()
        return jsonify({"success": False, "error": "Booking is already cancelled."}), 400

    # Rule: Cancellation allowed at least 2 hours before start time
    try:
        booking_start = datetime.datetime.strptime(f"{booking['date']} {booking['start_time']}", "%Y-%m-%d %H:%M")
        now = datetime.datetime.now()
        hours_before = (booking_start - now).total_seconds() / 3600.0
        if hours_before < 2.0:
            conn.close()
            return jsonify({
                "success": False, 
                "error": "Cancellations must be requested at least 2 hours prior to the session start time."
            }), 400
    except Exception as e:
        pass

    amount = float(booking["amount"])
    cursor.execute("SELECT owner_username FROM stations WHERE id = ?", (booking["station_id"],))
    st = cursor.fetchone()
    lender_username = st["owner_username"] if st else "lender1"

    with db_lock:
        try:
            # 1. Update Booking
            cursor.execute("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", (booking_id,))
            
            # 2. Free up slot
            cursor.execute("""
                UPDATE slots 
                SET status = 'AVAILABLE', booking_id = NULL, held_by = NULL, held_until = NULL, quoted_price = NULL
                WHERE booking_id = ?
            """, (booking_id,))

            # 3. Refund Driver wallet
            cursor.execute("UPDATE users SET wallet_balance = wallet_balance + ? WHERE username = ?", (amount, username))

            # 4. Debit Lender wallet
            cursor.execute("UPDATE users SET wallet_balance = wallet_balance - ? WHERE username = ?", (amount, lender_username))

            # 5. Record transactions
            cursor.execute("""
                INSERT INTO wallet_transactions (id, username, type, amount, booking_id, description)
                VALUES (?, ?, 'REFUND', ?, ?, ?)
            """, (str(uuid.uuid4()), username, amount, booking_id, f"Full refund for cancelled booking {booking_id}"))

            cursor.execute("""
                INSERT INTO wallet_transactions (id, username, type, amount, booking_id, description)
                VALUES (?, ?, 'DEBIT_BOOKING', ?, ?, ?)
            """, (str(uuid.uuid4()), lender_username, amount, booking_id, f"Refund debit adjustment for booking {booking_id}"))

            conn.commit()
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({"success": False, "error": f"Failed to cancel booking: {str(e)}"}), 500

    conn.close()

    broadcast_slot_update("SLOT_RELEASED", {
        "station_id": booking["station_id"],
        "plug_id": booking["plug_id"],
        "date": booking["date"],
        "start_time": booking["start_time"],
        "status": "AVAILABLE"
    })

    return jsonify({"success": True, "message": f"Booking {booking_id} cancelled and ₹{amount:.2f} refunded to your wallet."}), 200

# =========================================================================
# 9. BONUS: LENDER ANALYTICS & EARNINGS
# =========================================================================

@app.route("/api/lenders/analytics", methods=["GET"])
@jwt_required()
def get_lender_analytics():
    username = get_jwt_identity()
    claims = get_jwt()
    if claims.get("role") != "lender":
        return jsonify({"success": False, "error": "Access denied."}), 403

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT wallet_balance FROM users WHERE username = ?", (username,))
    wallet_bal = cursor.fetchone()["wallet_balance"]

    cursor.execute("""
        SELECT b.* 
        FROM bookings b 
        JOIN stations s ON b.station_id = s.id 
        WHERE s.owner_username = ?
        ORDER BY b.created_at DESC
    """, (username,))
    all_bookings = [dict(b) for b in cursor.fetchall()]

    confirmed_bookings = [b for b in all_bookings if b["status"] == "CONFIRMED"]
    total_booked_hours = sum(b["duration_hours"] for b in confirmed_bookings)
    gross_revenue = sum(b["amount"] for b in confirmed_bookings)

    cursor.execute("""
        SELECT SUM(amount) as refund_total 
        FROM wallet_transactions 
        WHERE username = ? AND description LIKE 'Refund debit adjustment%'
    """, (username,))
    rf_row = cursor.fetchone()
    refund_total = rf_row["refund_total"] if rf_row and rf_row["refund_total"] else 0.0

    net_revenue = max(0.0, gross_revenue - refund_total)

    # Calculate utilization: booked hours vs total operating hours (assuming 16h/day for station plugs)
    cursor.execute("""
        SELECT COUNT(p.id) as plug_count 
        FROM plugs p 
        JOIN stations s ON p.station_id = s.id 
        WHERE s.owner_username = ?
    """, (username,))
    plug_count = cursor.fetchone()["plug_count"] or 1
    total_available_hours = plug_count * 16.0 * 7.0  # 7-day window
    utilization_pct = min(100.0, round((total_booked_hours / max(1.0, total_available_hours)) * 100, 1))

    conn.close()

    return jsonify({
        "success": True,
        "wallet_balance": round(wallet_bal, 2),
        "confirmed_count": len(confirmed_bookings),
        "total_booked_hours": round(total_booked_hours, 1),
        "net_revenue": round(net_revenue, 2),
        "utilization_pct": utilization_pct,
        "recent_bookings": all_bookings[:20]
    }), 200

# =========================================================================
# 10. REAL-TIME SSE STREAM (Server-Sent Events)
# =========================================================================

@app.route("/api/slots/stream")
def slot_stream():
    """Server-Sent Events endpoint pushing real-time slot state changes."""
    def event_stream():
        q = queue.Queue(maxsize=50)
        with sse_lock:
            sse_subscribers.append(q)
        try:
            # Initial heartbeat to establish connection
            yield f"event: connected\ndata: {json.dumps({'message': 'SSE Connected', 'time': time.time()})}\n\n"
            while True:
                try:
                    msg = q.get(timeout=20)
                    yield msg
                except queue.Empty:
                    # Keep-alive ping
                    yield ": keepalive\n\n"
        finally:
            with sse_lock:
                if q in sse_subscribers:
                    sse_subscribers.remove(q)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

# Healthcheck
@app.route("/api/health", methods=["GET"])
def healthcheck():
    return jsonify({"status": "healthy", "service": "C-HIVE API", "time": datetime.datetime.utcnow().isoformat()}), 200

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 C-HIVE Flask Backend running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
