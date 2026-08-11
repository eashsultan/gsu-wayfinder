import os
import sqlite3
import secrets
import hashlib
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gsu.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS faculties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  faculty_id INTEGER REFERENCES faculties(id)
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  level INTEGER
);

CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  lat REAL,
  lng REAL,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  building_id INTEGER REFERENCES buildings(id),
  category TEXT DEFAULT 'Lecture Theatre',
  capacity INTEGER DEFAULT 0,
  lat REAL,
  lng REAL,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS campus_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Other',
  building_id INTEGER REFERENCES buildings(id),
  venue_id INTEGER REFERENCES venues(id),
  capacity INTEGER,
  lat REAL,
  lng REAL,
  description TEXT DEFAULT '',
  directions TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL UNIQUE,
  faculty_id INTEGER,
  department_id INTEGER,
  level INTEGER,
  role TEXT NOT NULL DEFAULT 'student',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER REFERENCES courses(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  level INTEGER,
  venue_id INTEGER REFERENCES venues(id),
  day INTEGER NOT NULL DEFAULT 0,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  rep_id INTEGER,
  published INTEGER DEFAULT 1,
  UNIQUE (venue_id, day, start_time)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
"""

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

FACULTIES = [
    ("Science", "SCI"),
    ("Arts & Social Sciences", "ASS"),
    ("Law", "LAW"),
    ("Pharmaceutical Sciences", "PHA"),
    ("Education", "EDU"),
    ("Medical Sciences", "MED"),
]

DEPARTMENTS = [
    ("Computer Science", "CSC", "Science"),
    ("Mathematics", "MTH", "Science"),
    ("Physics", "PHY", "Science"),
    ("Chemistry", "CHM", "Science"),
    ("Biological Sciences", "BIO", "Science"),
    ("Geology", "GEO", "Science"),
    ("Statistics", "STA", "Science"),
    ("Economics", "ECO", "Arts & Social Sciences"),
    ("Political Science", "POL", "Arts & Social Sciences"),
    ("Sociology", "SOC", "Arts & Social Sciences"),
    ("English", "ENG", "Arts & Social Sciences"),
    ("Law", "LAW", "Law"),
    ("Pharmaceutics", "PHA", "Pharmaceutical Sciences"),
    ("Education Sciences", "EDU", "Education"),
    ("Medical Sciences", "MED", "Medical Sciences"),
]

COURSES = [
    ("CSC301", "System Analysis & Design", "Computer Science", 300),
    ("CSC201", "Object-Oriented Programming", "Computer Science", 200),
    ("CSC401", "Software Engineering", "Computer Science", 400),
    ("MTH201", "Linear Algebra", "Mathematics", 200),
    ("MTH305", "Complex Analysis", "Mathematics", 300),
    ("PHY101", "General Physics I", "Physics", 100),
    ("CHM101", "General Chemistry I", "Chemistry", 100),
    ("BIO111", "General Biology I", "Biological Sciences", 100),
    ("STA301", "Statistical Methods", "Statistics", 300),
    ("ECO201", "Microeconomics", "Economics", 200),
    ("GNS101", "Use of English", "English", 100),
    ("LAW201", "Nigerian Legal System", "Law", 200),
    ("CSC302", "Data Structures & Algorithms", "Computer Science", 300),
]

BUILDINGS = [
    ("Senate Building", "ADM", 10.3042, 11.1728,
     "The primary administrative hub of Gombe State University, housing the Vice Chancellor's office, registry, and academic affairs division."),
    ("University Central Library", "LIB", 10.3051, 11.1740,
     "The main academic resource center with physical books, e-library terminals, and quiet study halls."),
    ("Faculty of Science Complex", "SCI", 10.3050, 11.1735,
     "Academic block containing classrooms, laboratories, and the Science Lecture Theatres."),
    ("Faculty of Arts & Social Sciences", "FASS", 10.3038, 11.1705,
     "Dean's office and department offices for the humanities and social sciences."),
    ("Faculty of Law Complex", "LAW", 10.3055, 11.1725,
     "Lecture theatres, mock trial rooms, and offices for the Faculty of Law."),
    ("Faculty of Pharmaceutical Sciences", "PHA", 10.3035, 11.1750,
     "Research labs, compounding rooms, and classrooms for Pharmacy students."),
    ("Faculty of Education Complex", "EDU", 10.3046, 11.1755,
     "Administrative offices and classrooms for the Faculty of Education."),
    ("Academic Building for Medical Sciences", "MED", 10.3031, 11.1746,
     "State-of-the-art building with laboratories and classrooms for Medical Sciences."),
    ("Central ICT Center", "ICT", 10.3053, 11.1742,
     "E-learning computer labs, server rooms, and internet access center."),
    ("University Health Clinic", "CLI", 10.3033, 11.1745,
     "Campus healthcare clinic providing primary consultations, first aid, and pharmacy services."),
    ("Central Student Cafeteria", "CAF", 10.3045, 11.1718,
     "Food court with vendors serving local meals and refreshments."),
    ("Main Male Hostel Block", "MHL", 10.3028, 11.1752,
     "Residential block providing accommodation for male students."),
    ("Main Female Hostel Complex", "FHL", 10.3031, 11.1739,
     "Secure residential compound for female students."),
    ("University Sports Complex", "SPT", 10.3025, 11.1762,
     "Sports facilities including a football pitch, basketball court, and running track."),
]

VENUES = [
    ("Lecture Theatre 1 (LT1)", "LT1", "Lecture Theatre", 350, 10.3048, 11.1730),
    ("Lecture Theatre 2 (LT2)", "LT2", "Lecture Theatre", 350, 10.3049, 11.1732),
    ("Lecture Theatre G1 (LT G1)", "LTG1", "Lecture Theatre", 180, 10.3047, 11.1731),
    ("Lecture Theatre G2 (LT G2)", "LTG2", "Lecture Theatre", 180, 10.3046, 11.1733),
    ("Lecture Theatre G3 (LT G3)", "LTG3", "Lecture Theatre", 180, 10.3049, 11.1734),
    ("Lecture Theatre G4 (LT G4)", "LTG4", "Lecture Theatre", 220, 10.3051, 11.1736),
    ("Lecture Theatre G5 (LT G5)", "LTG5", "Lecture Theatre", 220, 10.3052, 11.1738),
    ("Science Lecture Theatre A (SLTA)", "SLTA", "Lecture Theatre", 500, 10.3052, 11.1737),
    ("Science Lecture Theatre B (SLTB)", "SLTB", "Lecture Theatre", 500, 10.3051, 11.1739),
    ("Hall A", "HALL-A", "Hall", 250, 10.3049, 11.1741),
    ("Hall B", "HALL-B", "Hall", 250, 10.3050, 11.1743),
    ("250-Capacity Drama Theatre", "DRAMA", "Theatre", 250, 10.3039, 11.1708),
]

# Venue name -> building name
VENUE_BUILDINGS = {
    "Lecture Theatre 1 (LT1)": "Faculty of Science Complex",
    "Lecture Theatre 2 (LT2)": "Faculty of Science Complex",
    "Lecture Theatre G1 (LT G1)": "Faculty of Science Complex",
    "Lecture Theatre G2 (LT G2)": "Faculty of Science Complex",
    "Lecture Theatre G3 (LT G3)": "Faculty of Science Complex",
    "Lecture Theatre G4 (LT G4)": "Faculty of Science Complex",
    "Lecture Theatre G5 (LT G5)": "Faculty of Science Complex",
    "Science Lecture Theatre A (SLTA)": "Faculty of Science Complex",
    "Science Lecture Theatre B (SLTB)": "Faculty of Science Complex",
    "Hall A": "Faculty of Education Complex",
    "Hall B": "Faculty of Education Complex",
    "250-Capacity Drama Theatre": "Faculty of Arts & Social Sciences",
}

# type -> building name / venue name  (campus map pins)
PLACES = [
    ("Senate Building (VC's Office)", "Office", "Senate Building", None,
     "The primary administrative hub of Gombe State University, housing the Vice Chancellor's office, registry, and academic affairs division.",
     "From the Main Gate, follow the main driveway straight for about 200 meters. The imposing Senate Building is located on your right, past the central roundabout.",
     10.3042, 11.1728),
    ("Main Campus Gate", "Other", None, None,
     "The primary vehicle and pedestrian entrance/exit point of the GSU campus.",
     "Located along the main bypass highway. Security personnel are stationed here 24/7.",
     10.3025, 11.1712),
    ("University Central Library", "Library", "University Central Library", None,
     "The main academic resource center, offering physical books, digital library terminals, quiet study halls, and reference materials.",
     "From the Senate Building roundabout, take the left path. Walk past the Faculty of Science, and the Library will be the large multi-story structure on your right.",
     10.3051, 11.1740),
    ("Central ICT Center", "Library", "Central ICT Center", None,
     "E-learning computer labs, university server rooms, and internet access center for registration and online exams.",
     "Situated just north of the University Central Library, walking distance from the science complex.",
     10.3053, 11.1742),
    ("Faculty of Science Complex", "Office", "Faculty of Science Complex", None,
     "The main science academic block containing classrooms, departmental offices, laboratories, and the major Science Lecture Theatres: SLTA and SLTB.",
     "Located 180m northeast of the Senate Building roundabout, housing the Biology, Chemistry, and Physics departments.",
     10.3050, 11.1735),
    ("University Health Clinic", "Clinic", "University Health Clinic", None,
     "Campus healthcare clinic providing primary medical consultations, emergency first aid, pharmacy services, and health advice for students.",
     "Located on the southern campus loop. Pass the male hostels and turn right; the clinic is the single-story building marked with a red cross sign.",
     10.3033, 11.1745),
    ("Faculty of Arts & Social Sciences (FASS)", "Office", "Faculty of Arts & Social Sciences", None,
     "Dean's office, department offices (History, Political Science, Sociology, English), and faculty-specific classrooms.",
     "Take the western campus pathway from the main gate. The FASS complex is the second block on the left side of the lane.",
     10.3038, 11.1705),
    ("Central Student Cafeteria", "Restaurant", "Central Student Cafeteria", None,
     "Food court with local vendors serving Jollof rice, Masa, Tuwo, snacks, and refreshing drinks at student-friendly prices.",
     "Situated in the central campus square, directly opposite the student center building.",
     10.3045, 11.1718),
    ("Main Male Hostel Block", "Hostel", "Main Male Hostel Block", None,
     "Residential block providing accommodation for male students of Gombe State University.",
     "Located at the south-eastern boundary of the campus, close to the sports ground.",
     10.3028, 11.1752),
    ("Main Female Hostel Complex", "Hostel", "Main Female Hostel Complex", None,
     "Secure residential compound for female students, featuring individual halls and a common room.",
     "Located near the university clinic on the south side of campus. Access is gated and highly secured.",
     10.3031, 11.1739),
    ("University Sports Complex", "Sports", "University Sports Complex", None,
     "Campus sports facilities including a football pitch, basketball court, running track, and volleyball facilities.",
     "Located at the eastern edge of the university campus. Follow the signs from the male hostels.",
     10.3025, 11.1762),
    ("Faculty of Law Complex", "Office", "Faculty of Law Complex", None,
     "Modern lecture theatres, mock trial rooms, and department offices for Law students at Gombe State University.",
     "Situated on the northern academic loop road, just north-west of the main Library complex.",
     10.3055, 11.1725),
    ("Faculty of Pharmaceutical Sciences Complex", "Office", "Faculty of Pharmaceutical Sciences", None,
     "Contains research labs, compounding rooms, and classrooms for Pharmacy students.",
     "Located on the south-east side of campus, walk past the University clinic towards the sports field.",
     10.3035, 11.1750),
    ("Faculty of Education Complex", "Office", "Faculty of Education Complex", None,
     "Administrative offices, educational research labs, and classrooms for the Faculty of Education.",
     "Located on the eastern side of the campus loop road.",
     10.3046, 11.1755),
    ("Academic Building for Medical Sciences", "Office", "Academic Building for Medical Sciences", None,
     "State-of-the-art building housing laboratories, classrooms, and offices for Anatomy, Physiology, and MBBS students.",
     "Located directly adjacent to the University Health Clinic on the southern loop.",
     10.3031, 11.1746),
    ("GSU Botanical Garden", "Other", None, None,
     "Tranquil green reserve area containing native plants, study benches, and research flora.",
     "Located at the far western boundary of GSU campus, past the FASS building complex.",
     10.3035, 11.1695),
]

# Classes: course code, department, level, venue name, day(0=Mon..6=Sun), start, end
WEEKLY_CLASSES = [
    ("CSC301", "Computer Science", 300, "Lecture Theatre G4 (LT G4)", 0, "10:00", "12:00"),
    ("MTH305", "Mathematics", 300, "Lecture Theatre G2 (LT G2)", 0, "13:00", "15:00"),
    ("PHY101", "Physics", 100, "Lecture Theatre 1 (LT1)", 1, "09:00", "11:00"),
    ("CSC201", "Computer Science", 200, "Lecture Theatre 1 (LT1)", 1, "12:00", "14:00"),
    ("MTH201", "Mathematics", 200, "Lecture Theatre G3 (LT G3)", 2, "10:00", "12:00"),
    ("CHM101", "Chemistry", 100, "Science Lecture Theatre A (SLTA)", 2, "13:00", "15:00"),
    ("BIO111", "Biological Sciences", 100, "Lecture Theatre 2 (LT2)", 3, "09:00", "11:00"),
    ("STA301", "Statistics", 300, "Hall B", 3, "12:00", "14:00"),
    ("ECO201", "Economics", 200, "Lecture Theatre G1 (LT G1)", 4, "10:00", "12:00"),
    ("GNS101", "English", 100, "Science Lecture Theatre B (SLTB)", 4, "13:00", "15:00"),
    ("LAW201", "Law", 200, "Hall A", 0, "14:00", "16:00"),
    ("CSC401", "Computer Science", 400, "Lecture Theatre G5 (LT G5)", 5, "09:00", "11:00"),
    ("CSC302", "Computer Science", 300, "Lecture Theatre G2 (LT G2)", 1, "12:00", "14:00"),
    ("CSC305", "Computer Science", 300, "Lecture Theatre G4 (LT G4)", 2, "09:00", "11:00"),
    ("CSC204", "Computer Science", 200, "Lecture Theatre G1 (LT G1)", 2, "14:00", "16:00"),
]

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def _execute(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur
    finally:
        conn.close()

def _fetchall(sql, params=()):
    conn = get_conn()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def _fetchone(sql, params=()):
    conn = get_conn()
    try:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def insert_row(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                                 salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"

def verify_password(password, stored):
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                               salt.encode("utf-8"), 100_000).hex()
    return secrets.compare_digest(calc, digest)

def create_session(user_id):
    token = secrets.token_hex(32)
    _execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, datetime.utcnow().isoformat()),
    )
    return token

def delete_session(token):
    _execute("DELETE FROM sessions WHERE token = ?", (token,))

def get_user_from_token(token):
    if not token:
        return None
    return _fetchone(
        """SELECT u.*, f.name AS faculty, d.name AS department
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN faculties f ON f.id = u.faculty_id
           LEFT JOIN departments d ON d.id = u.department_id
           WHERE s.token = ?""",
        (token,),
    )

def serialize_user(u):
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "student_id": u["student_id"],
        "faculty": u.get("faculty") or u.get("faculty_id") or "",
        "department": u.get("department") or u.get("department_id") or "",
        "level": u["level"] if isinstance(u["level"], int) else u["level"],
        "role": u["role"],
    }

# ---------------------------------------------------------------------------
# Location helpers (campus_locations)
# ---------------------------------------------------------------------------

def list_locations():
    return _fetchall(
        """SELECT cl.*, b.name AS building_name, v.capacity AS venue_capacity
           FROM campus_locations cl
           LEFT JOIN buildings b ON b.id = cl.building_id
           LEFT JOIN venues v ON v.id = cl.venue_id
           ORDER BY cl.type, cl.name"""
    )

def add_location(payload):
    name = payload.get("name")
    lat = payload.get("lat")
    lng = payload.get("lng")
    if not name or lat is None or lng is None:
        raise ValueError("Name, latitude and longitude are required.")
    cur = _execute(
        """INSERT INTO campus_locations (name, type, description, directions, lat, lng)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name, payload.get("category", "Other"), payload.get("description", ""),
         payload.get("directions", ""), lat, lng),
    )
    return _fetchone("SELECT * FROM campus_locations WHERE id = ?", (cur.lastrowid,))

def delete_location(loc_id):
    _execute("DELETE FROM campus_locations WHERE id = ?", (loc_id,))
    return _fetchone("SELECT id FROM campus_locations WHERE id = ?", (loc_id,)) is None

# ---------------------------------------------------------------------------
# Venues / classes helpers
# ---------------------------------------------------------------------------

def list_venues():
    return _fetchall(
        """SELECT v.*, b.name AS building_name
           FROM venues v
           LEFT JOIN buildings b ON b.id = v.building_id
           ORDER BY v.name"""
    )

def list_classes():
    return _fetchall(
        """SELECT c.*, co.code AS course_code, co.title AS course_title,
                  d.name AS department, v.name AS venue_name,
                  v.lat AS venue_lat, v.lng AS venue_lng, v.capacity AS venue_capacity
           FROM classes c
           JOIN courses co ON co.id = c.course_id
           LEFT JOIN departments d ON d.id = c.department_id
           LEFT JOIN venues v ON v.id = c.venue_id
           ORDER BY c.day, c.start_time"""
    )

# ---------------------------------------------------------------------------
# Live venue status + student schedule
# ---------------------------------------------------------------------------

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def list_venues_with_status():
    venues = list_venues()
    classes = list_classes()
    now = datetime.now()
    today = now.weekday()
    now_min = now.hour * 60 + now.minute

    out = []
    for v in venues:
        todays = [c for c in classes if c["venue_id"] == v["id"] and c["day"] == today]
        todays.sort(key=lambda c: c["start_time"])
        for c in todays:
            st = _to_min(c["start_time"])
            en = _to_min(c["end_time"])
            c["slot_status"] = "ongoing" if st <= now_min < en else ("upcoming" if st > now_min else "done")
        current = None
        next_cls = None
        for c in todays:
            st = _to_min(c["start_time"])
            en = _to_min(c["end_time"])
            if st <= now_min < en:
                current = c
            elif st > now_min and not current and next_cls is None:
                next_cls = c
        row = {
            "id": v["id"],
            "name": v["name"],
            "code": v["code"],
            "category": v["category"],
            "capacity": v["capacity"],
            "building": v["building_name"],
            "lat": v["lat"],
            "lng": v["lng"],
            "status": "occupied" if current else "available",
            "current_class": current,
            "next_class": next_cls,
            "today_classes": todays,
        }
        out.append(row)
    return out

def student_schedule(user):
    """Classes for a student, filtered by their level + department."""
    classes = list_classes()
    user_dept = user.get("department_id")
    user_level = user.get("level")

    mine = []
    for c in classes:
        if user_level and c["level"] not in (None, user_level):
            continue
        if user_dept and c["department_id"] not in (None, user_dept):
            continue
        mine.append(c)

    mine.sort(key=lambda c: (c["day"], c["start_time"]))

    now = datetime.now()
    today = now.weekday()
    now_min = now.hour * 60 + now.minute

    today_list = []
    for c in mine:
        if c["day"] != today:
            continue
        st = _to_min(c["start_time"])
        en = _to_min(c["end_time"])
        c["today_status"] = "ongoing" if st <= now_min < en else ("upcoming" if st > now_min else "done")
        today_list.append(c)

    next_class = None
    for c in today_list:
        if c["today_status"] == "upcoming":
            next_class = c
            break
    if next_class is None:
        for c in today_list:
            if c["today_status"] == "ongoing":
                next_class = c
                break
    if next_class is None:
        for c in mine:
            if c["day"] > today:
                next_class = c
                break
    if next_class is None and mine:
        next_class = mine[0]

    return {
        "today": today_list,
        "week": mine,
        "next": next_class,
    }

# ---------------------------------------------------------------------------
# Overview for landing "Live Campus"
# ---------------------------------------------------------------------------

def get_overview():
    venues = list_venues()
    classes = list_classes()
    now = datetime.now()
    today = now.weekday()
    now_min = now.hour * 60 + now.minute

    occupied, available, upcoming = [], [], []
    for v in venues:
        current = None
        for c in classes:
            if c["venue_id"] == v["id"] and c["day"] == today:
                start = _to_min(c["start_time"])
                end = _to_min(c["end_time"])
                if start <= now_min < end:
                    current = c
                    break
        if current:
            occupied.append({"venue": v, "class": current, "status": "occupied"})
        else:
            available.append({"venue": v, "status": "available"})

    upcoming = []
    for c in classes:
        if c["day"] == today:
            start = _to_min(c["start_time"])
            if start > now_min:
                upcoming.append({
                    "venue": c["venue_name"],
                    "venue_id": c["venue_id"],
                    "code": c["code"],
                    "title": c["title"],
                    "start_time": c["start_time"],
                    "end_time": c["end_time"],
                })
    upcoming.sort(key=lambda x: x["start_time"])

    return {
        "total_venues": len(venues),
        "available_venues": len(available),
        "occupied_venues": len(occupied),
        "occupied": occupied[:6],
        "available": available[:6],
        "upcoming_classes": upcoming[:6],
        "total_locations": len(list_locations()),
    }

def _to_min(t):
    try:
        hh, mm = t.split(":")
        return int(hh) * 60 + int(mm)
    except Exception:
        return 0

# ---------------------------------------------------------------------------
# Initialization + seed
# ---------------------------------------------------------------------------

def init_db(first_time=False):
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()

    empty = _fetchone("SELECT COUNT(*) AS n FROM faculties")["n"] == 0
    if first_time or empty:
        seed(force=first_time)

def seed(force=False):
    if force:
        conn = get_conn()
        try:
            conn.executescript("""
                DROP TABLE IF EXISTS notifications;
                DROP TABLE IF EXISTS sessions;
                DROP TABLE IF EXISTS classes;
                DROP TABLE IF EXISTS campus_locations;
                DROP TABLE IF EXISTS venues;
                DROP TABLE IF EXISTS buildings;
                DROP TABLE IF EXISTS courses;
                DROP TABLE IF EXISTS departments;
                DROP TABLE IF EXISTS faculties;
                DROP TABLE IF EXISTS users;
            """)
            conn.commit()
        finally:
            conn.close()
        init_db()

    if _fetchone("SELECT COUNT(*) AS n FROM faculties")["n"] > 0:
        return

    # Faculties
    for name, code in FACULTIES:
        _execute("INSERT INTO faculties (name, code) VALUES (?, ?)", (name, code))

    fac_by_name = {f["name"]: f["id"] for f in _fetchall("SELECT * FROM faculties")}

    # Departments
    for name, code, fac in DEPARTMENTS:
        _execute(
            "INSERT INTO departments (name, code, faculty_id) VALUES (?, ?, ?)",
            (name, code, fac_by_name.get(fac)),
        )
    dep_by_name = {d["name"]: d["id"] for d in _fetchall("SELECT * FROM departments")}

    # Courses
    for code, title, dep, level in COURSES:
        _execute(
            "INSERT INTO courses (code, title, department_id, level) VALUES (?, ?, ?, ?)",
            (code, title, dep_by_name.get(dep), level),
        )
    course_by_code = {c["code"]: c["id"] for c in _fetchall("SELECT * FROM courses")}

    # Buildings
    for name, code, lat, lng, desc in BUILDINGS:
        _execute(
            "INSERT INTO buildings (name, code, lat, lng, description) VALUES (?, ?, ?, ?, ?)",
            (name, code, lat, lng, desc),
        )
    bld_by_name = {b["name"]: b["id"] for b in _fetchall("SELECT * FROM buildings")}

    # Venues
    for name, code, cat, cap, lat, lng in VENUES:
        _execute(
            "INSERT INTO venues (name, code, building_id, category, capacity, lat, lng, description) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (name, code, bld_by_name.get(VENUE_BUILDINGS.get(name)), cat, cap, lat, lng,
             f"{name} — capacity {cap} seats."),
        )
    venue_by_name = {v["name"]: v["id"] for v in _fetchall("SELECT * FROM venues")}

    # Campus locations (places)
    for name, ptype, bld, venue, desc, directions, lat, lng in PLACES:
        _execute(
            "INSERT INTO campus_locations (name, type, building_id, venue_id, lat, lng, description, directions) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (name, ptype, bld_by_name.get(bld), venue_by_name.get(venue),
             lat, lng, desc, directions),
        )
    # Also expose every bookable venue on the map
    for v in list_venues():
        _execute(
            "INSERT INTO campus_locations (name, type, building_id, venue_id, capacity, lat, lng, description) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (v["name"], v["category"], v["building_id"], v["id"], v["capacity"],
             v["lat"], v["lng"], v["description"]),
        )

    # Weekly classes
    for code, dep_name, level, venue, day, start, end in WEEKLY_CLASSES:
        _execute(
            """INSERT INTO classes (course_id, code, title, department_id, level, venue_id, day, start_time, end_time, published)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (course_by_code.get(code), code, code, dep_by_name.get(dep_name), level,
             venue_by_name.get(venue), day, start, end),
        )

    # Admin account (password: admin123)
    _execute(
        """INSERT INTO users (name, email, student_id, level, role, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        ("GSU Administrator", "admin@gsu.edu.ng", "GSU/ADMIN/000", 0, "admin",
         hash_password("admin123"), datetime.utcnow().isoformat()),
    )
    # Demo student (password: student123)
    _execute(
        """INSERT INTO users (name, email, student_id, faculty_id, department_id, level, role, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("Demo Student", "demo.student@gsu.edu.ng", "GSU/CSC/21/1001",
         fac_by_name.get("Science"), dep_by_name.get("Computer Science"), 300, "student",
         hash_password("student123"), datetime.utcnow().isoformat()),
    )
    # Demo class representative (password: rep123)
    _execute(
        """INSERT INTO users (name, email, student_id, faculty_id, department_id, level, role, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("Aisha Mohammed", "aisha.rep@gsu.edu.ng", "GSU/CSC/20/1001",
         fac_by_name.get("Science"), dep_by_name.get("Computer Science"), 300, "class_rep",
         hash_password("rep123"), datetime.utcnow().isoformat()),
    )


# Bootstrap
if not os.path.exists(DB_PATH) or os.environ.get("GSU_RESET_DB") == "1":
    init_db(first_time=True)
else:
    init_db()