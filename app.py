from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
import joblib
from datetime import datetime
import math
import sqlite3
import os
import re
from werkzeug.security import generate_password_hash, check_password_hash

# --- Database Automatic Setup at Initialization ---
def init_database():
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

    # 5. SOS Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sos_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        latitude REAL,
        longitude REAL,
        timestamp TEXT NOT NULL,
        contacts_notified TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# Run database setup programmatically at script import time (Render deployment safe)
init_database()

app = Flask(__name__)
app.secret_key = "safeher_super_secure_key_1298471"

model = joblib.load("models/safety_model.pkl")

# Database connection factory
def get_db():
    conn = sqlite3.connect("data/safety_system.db")
    conn.row_factory = sqlite3.Row
    return conn

# Helper function to compute distance in degrees (Nagpur relative)
def calculate_distance(lat1, lng1, lat2, lng2):
    return math.sqrt((lat1 - lat2)**2 + (lng1 - lng2)**2)

# --- Authentication Decorator ---
def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Routes ---

@app.route("/")
@login_required
def dashboard():
    return render_template("dashboard.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()
        
        if user and check_password_hash(user["password"], password):
            session["user_id"] = user["id"]
            session["user_name"] = user["name"]
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid email or password.")
            return redirect(url_for('login'))
            
    return render_template("auth.html")

@app.route("/register", methods=["POST"])
def register():
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()
    phone = request.form.get("phone", "").strip()
    password = request.form.get("password", "")
    
    if not name or not email or not phone or not password:
        flash("All registration fields are required.")
        return redirect(url_for('login', register=True))
        
    # --- Server-Side Validations ---
    email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    if not re.match(email_regex, email):
        flash("Please enter a valid email address.")
        return redirect(url_for('login', register=True))

    if len(password) < 6:
        flash("Password must contain at least 6 characters.")
        return redirect(url_for('login', register=True))

    if not phone.isdigit() or len(phone) != 10:
        flash("Phone number must contain exactly 10 digits.")
        return redirect(url_for('login', register=True))
        
    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        flash("Email address already registered.")
        return redirect(url_for('login', register=True))
        
    # Hash password and insert
    hashed_pwd = generate_password_hash(password)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)",
            (name, email, phone, hashed_pwd)
        )
        user_id = cursor.lastrowid
        
        # Insert default settings
        cursor.execute(
            "INSERT INTO settings (user_id, auto_sos, voice_sos, language, notifications, dark_mode) VALUES (?, 1, 1, 'English', 1, 1)",
            (user_id,)
        )
        conn.commit()
        
        session["user_id"] = user_id
        session["user_name"] = name
        
    except Exception as e:
        conn.rollback()
        flash("Database integration failed. Retry registration.")
        print("Registration DB Error:", e)
        return redirect(url_for('login', register=True))
    finally:
        conn.close()
        
    return redirect(url_for('dashboard'))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login'))

# --- User Profile Settings Persistent APIs ---
@app.route("/settings", methods=["GET", "POST"])
@login_required
def user_settings():
    user_id = session["user_id"]
    conn = get_db()
    
    if request.method == "POST":
        data = request.get_json()
        
        auto_sos = 1 if data.get("auto_sos") else 0
        voice_sos = 1 if data.get("voice_sos") else 0
        language = data.get("language", "English")
        notifications = 1 if data.get("notifications") else 0
        dark_mode = 1 if data.get("dark_mode") else 0
        
        # Profile Updates
        name = data.get("name", "").strip()
        phone = data.get("phone", "").strip()
        
        # Validation checks
        if name and phone:
            if not phone.isdigit() or len(phone) != 10:
                conn.close()
                return jsonify({"status": "error", "message": "Phone number must be exactly 10 digits."}), 400
                
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE settings 
               SET auto_sos = ?, voice_sos = ?, language = ?, notifications = ?, dark_mode = ?
               WHERE user_id = ?""",
            (auto_sos, voice_sos, language, notifications, dark_mode, user_id)
        )
        
        if name and phone:
            cursor.execute(
                "UPDATE users SET name = ?, phone = ? WHERE id = ?",
                (name, phone, user_id)
            )
            session["user_name"] = name
            
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Settings updated successfully."})
        
    # GET settings
    settings = conn.execute("SELECT * FROM settings WHERE user_id = ?", (user_id,)).fetchone()
    profile = conn.execute("SELECT name, email, phone FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    
    return jsonify({
        "name": profile["name"],
        "email": profile["email"],
        "phone": profile["phone"],
        "auto_sos": bool(settings["auto_sos"]),
        "voice_sos": bool(settings["voice_sos"]),
        "language": settings["language"],
        "notifications": bool(settings["notifications"]),
        "dark_mode": bool(settings["dark_mode"])
    })

# --- Emergency Contacts Database APIs ---
@app.route("/contacts", methods=["GET", "POST", "DELETE"])
@login_required
def sync_contacts():
    user_id = session["user_id"]
    conn = get_db()
    
    if request.method == "POST":
        data = request.get_json()
        name = data.get("name", "").strip()
        phone = data.get("phone", "").strip()
        
        if not name or not phone:
            conn.close()
            return jsonify({"status": "error", "message": "Name and phone parameters required."}), 400

        if not phone.isdigit() or len(phone) != 10:
            conn.close()
            return jsonify({"status": "error", "message": "Phone number must be exactly 10 digits."}), 400
            
        # --- Duplicate Checks ---
        existing = conn.execute(
            "SELECT id FROM contacts WHERE user_id = ? AND (name = ? OR phone = ?)",
            (user_id, name, phone)
        ).fetchone()
        
        if existing:
            conn.close()
            return jsonify({"status": "error", "message": "Contact with this name or phone already exists."}), 400
            
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO contacts (user_id, name, phone) VALUES (?, ?, ?)",
            (user_id, name, phone)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Contact added successfully."})
        
    elif request.method == "DELETE":
        data = request.get_json()
        name = data.get("name", "").strip()
        phone = data.get("phone", "").strip()
        
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM contacts WHERE user_id = ? AND name = ? AND phone = ?",
            (user_id, name, phone)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Contact deleted successfully."})
        
    # GET contacts
    contacts = conn.execute("SELECT name, phone FROM contacts WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    
    return jsonify([{"name": c["name"], "phone": c["phone"]} for c in contacts])

# --- SOS Logging API Route ---
@app.route("/sos", methods=["POST"])
@login_required
def log_sos_event():
    user_id = session["user_id"]
    data = request.get_json()
    lat = data.get("lat")
    lng = data.get("lng")
    
    conn = get_db()
    # Fetch registered contact names to log who was notified
    contacts = conn.execute("SELECT name FROM contacts WHERE user_id = ?", (user_id,)).fetchall()
    contacts_notified = ", ".join([c["name"] for c in contacts]) if contacts else "None"
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sos_events (user_id, latitude, longitude, timestamp, contacts_notified) VALUES (?, ?, ?, ?, ?)",
        (user_id, lat, lng, timestamp, contacts_notified)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "SOS distress logs saved in SQL."})

# --- Chatbot AI Safety Assistant API ---
@app.route("/chat", methods=["POST"])
@login_required
def chat_assistant():
    data = request.get_json()
    message = data.get("message", "").strip().lower()
    
    score = data.get("score", 90)
    safety = data.get("safety", "SAFE")
    closest_station = data.get("closest_station", "Sadar Patrolling Post")
    contacts_count = data.get("contacts_count", 0)
    
    if "help" in message or "emergency" in message or "danger" in message or "sos" in message:
        reply = (
            "⚠️ **EMERGENCY ASSISTANT PROTOCOL:**<br>"
            "1. Click the large red **SEND SOS** button immediately to run a 3-second countdown to alert contacts.<br>"
            "2. Say **'HELP ME'** aloud; Voice SOS is listening and will automatically notify contacts.<br>"
            f"3. Reach nearest beacon: **{closest_station}**."
        )
    elif "safe" in message or "risk" in message or "score" in message:
        reply = (
            f"🔍 **SAFETY PROFILE CONSOLE:**<br>"
            f"Your current safety status: **{safety}** with safety rating: **{score}%**.<br>"
            f"Surrounding area indicators: {insight_description(safety)}.<br>"
            f"Nearest safe facility: **{closest_station}**."
        )
    elif "contact" in message or "phone" in message or "register" in message:
        reply = (
            f"👤 **CONTACTS REGISTRY:**<br>"
            f"You currently have **{contacts_count} registered contact(s)**.<br>"
            "You can manage them in the **Trusted Contacts** panel. In an emergency, all registered numbers receive location SMS alerts."
        )
    elif "route" in message or "path" in message:
        reply = (
            "🛣️ **SAFE PATH PATHFINDER:**<br>"
            "Click **'Show Safe Route'** on the recommendations card. "
            f"We have drawn a safe path avoiding dark zones, routing to **{closest_station}**."
        )
    else:
        reply = (
            "🤖 **SAFEHER ASSISTANT:**<br>"
            "I'm here to help navigate. Ask me:<br>"
            "- *'Am I safe here?'*<br>"
            "- *'What is the emergency plan?'*<br>"
            "- *'Tell me about my contacts'*<br>"
            "- *'Show safe routes'*"
        )
        
    return jsonify({"reply": reply})

def insight_description(safety):
    if safety == "SAFE":
        return "Low historical crime rates, active daytime crowd presence, and optimal patrolling coverage."
    elif safety == "MEDIUM":
        return "Moderate crowd presence, decreasing evening lighting parameters. Stick to main roads."
    else:
        return "Late hours with zero pedestrian density and proximity to elevated crime zones."

# --- Dynamic Predictions API ---
@app.route("/predict")
@login_required
def predict():
    # Parse lat and lng parameters from request query
    lat_str = request.args.get('lat')
    lng_str = request.args.get('lng')
    
    try:
        lat = float(lat_str) if lat_str else 21.1458
        lng = float(lng_str) if lng_str else 79.0882
    except ValueError:
        lat = 21.1458
        lng = 79.0882
        
    current_hour = datetime.now().hour
    
    # 1. Dynamic Crime Rate Calculation
    dist_a = calculate_distance(lat, lng, 21.1498, 79.0922)
    dist_b = calculate_distance(lat, lng, 21.1418, 79.0852)
    dist_c = calculate_distance(lat, lng, 21.1468, 79.0862)
    
    crime_rate_a = max(10, 80 - dist_a * 8000)
    crime_rate_b = max(10, 70 - dist_b * 6000)
    crime_rate_c = max(10, 45 - dist_c * 4000)
    
    crime_rate = int(max(crime_rate_a, crime_rate_b, crime_rate_c))
    crime_rate = min(99, max(5, crime_rate))
    
    # 2. Dynamic Crowd Density Calculation
    if 8 <= current_hour < 18:
        base_crowd = 70
    elif 18 <= current_hour < 22:
        base_crowd = 50
    elif 22 <= current_hour <= 23 or 0 <= current_hour < 2:
        base_crowd = 20
    else:
        base_crowd = 5
        
    if dist_a < 0.006:
        crowd_density = int(base_crowd + (0.006 - dist_a) * 4000)
    else:
        crowd_density = int(max(2, base_crowd - (dist_a - 0.006) * 100))
    crowd_density = min(95, max(2, crowd_density))
    
    # 3. Random Forest Prediction & Probabilities
    features = [[current_hour, crime_rate, crowd_density]]
    prediction = model.predict(features)[0]
    
    probs = model.predict_proba(features)[0]
    classes = list(model.classes_)
    
    safe_idx = classes.index('SAFE') if 'SAFE' in classes else -1
    medium_idx = classes.index('MEDIUM') if 'MEDIUM' in classes else -1
    unsafe_idx = classes.index('UNSAFE') if 'UNSAFE' in classes else -1
    
    prob_safe = probs[safe_idx] if safe_idx != -1 else 0.0
    prob_medium = probs[medium_idx] if medium_idx != -1 else 0.0
    prob_unsafe = probs[unsafe_idx] if unsafe_idx != -1 else 0.0
    
    score = int(prob_safe * 100 + prob_medium * 50)
    pred_idx = classes.index(prediction) if prediction in classes else 0
    confidence = int(probs[pred_idx] * 100)
    
    if prediction == "SAFE":
        score = max(65, score)
    elif prediction == "MEDIUM":
        score = min(64, max(40, score))
    else:
        score = min(39, score)
        
    # 4. Generate Explanations & Insights
    time_str = f"{current_hour:02d}:00"
    explanation = (
        f"Hourly factor set at {time_str}. "
        f"Nearby crime hotspot proximity yields an index of {crime_rate}%. "
        f"Historical crowd density registers {crowd_density}%. "
        f"Classifier safety probability confidence is {confidence}%."
    )
    
    if prediction == "SAFE":
        insight = "OPTIMAL: Safe daytime profile. High pedestrian presence and close proximity to patrol vectors. Safe route verified."
    elif prediction == "MEDIUM":
        insight = "WARNING: Decreasing evening visibility and moderate pedestrian counts. Keep main corridors mapped."
    else:
        insight = "CRITICAL: Night profile with low public presence. Elevated crime hotspot proximity. Rest secure; utilize SOS guides."
        
    return jsonify({
        "safety": prediction,
        "score": score,
        "confidence": confidence,
        "crime_rate": crime_rate,
        "crowd_density": crowd_density,
        "explanation": explanation,
        "insight": insight
    })

if __name__ == "__main__":
    app.run(debug=True)