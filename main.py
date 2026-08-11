import os
import json
import logging
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import google.generativeai as genai
from dotenv import load_dotenv

import db

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gsu-wayfinder-backend")

app = FastAPI(
    title="GSU Navigator AI API",
    description="Backend API for Gombe State University campus navigator and venue management.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RegisterModel(BaseModel):
    name: str
    student_id: str
    email: str
    faculty: Optional[str] = ""
    department: Optional[str] = ""
    level: Optional[str] = "100"
    role: str = "student"  # student | class_rep
    password: str


class LoginModel(BaseModel):
    email_or_id: str
    password: str


class Place(BaseModel):
    name: str
    category: str = "Other"
    description: Optional[str] = ""
    directions: Optional[str] = ""
    lat: float
    lng: float


class ChatQuery(BaseModel):
    query: str
    api_key: Optional[str] = None
    user_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    scheme, _, token = authorization.partition(" ")
    token = (token or authorization).strip()
    user = db.get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return user


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

def get_current_user(authorization: Optional[str] = Header(None)):
    return current_user(authorization)

@app.post("/api/auth/register")
async def register(user_data: RegisterModel):
    name = user_data.name.strip()
    email = user_data.email.strip().lower()
    student_id = user_data.student_id.strip().lower()
    password = user_data.password

    if not name or not email or not student_id or len(password) < 6:
        raise HTTPException(status_code=400, detail="Please fill in all fields (password must be at least 6 characters).")

    existing = db._fetchone(
        """SELECT id, email, student_id FROM users
           WHERE email = ? OR student_id = ?""",
        (email, student_id),
    )
    if existing:
        raise HTTPException(status_code=400, detail="Student ID or Email already registered.")

    fac = db._fetchone("SELECT id FROM faculties WHERE LOWER(name) = ?", (user_data.faculty.strip().lower(),))
    dep = db._fetchone("SELECT id FROM departments WHERE LOWER(name) = ?", (user_data.department.strip().lower(),))
    level = user_data.level
    try:
        level = int(level)
    except (TypeError, ValueError):
        level = 100

    tmp = {
        "name": name,
        "email": email,
        "student_id": student_id,
        "faculty_id": fac["id"] if fac else None,
        "department_id": dep["id"] if dep else None,
        "level": level,
        "role": user_data.role if user_data.role in ("student", "class_rep") else "student",
    }
    user_id = db.insert_row(
        """INSERT INTO users (name, email, student_id, faculty_id, department_id, level, role, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (tmp["name"], tmp["email"], tmp["student_id"], tmp["faculty_id"],
         tmp["department_id"], tmp["level"], tmp["role"],
         db.hash_password(password), __import__("datetime").datetime.utcnow().isoformat()),
    )

    token = db.create_session(user_id)
    fresh = db.get_user_from_token(token)
    return {"message": "Registration successful", "token": token, "user": db.serialize_user(fresh)}


@app.post("/api/auth/login")
async def login(login_data: LoginModel):
    term = login_data.email_or_id.strip().lower()
    user = db._fetchone(
        """SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(student_id) = ?""",
        (term, term),
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not db.verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect password.")

    token = db.create_session(user["id"])
    auth_user = db.get_user_from_token(token)
    return {"message": "Login successful", "token": token, "user": db.serialize_user(auth_user)}


@app.post("/api/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        _, _, token = authorization.partition(" ")
        db.delete_session((token or authorization).strip())
    return {"message": "Logged out."}


@app.get("/api/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": db.serialize_user(user)}


# ---------------------------------------------------------------------------
# Places (campus locations)
# ---------------------------------------------------------------------------

@app.get("/api/places")
async def get_places():
    rows = db.list_locations()
    out = []
    for r in rows:
        out.append({
            "id": f"place-{r['id']}",
            "name": r["name"],
            "category": r["type"],
            "description": r["description"] or "",
            "directions": r["directions"] or "",
            "lat": r["lat"],
            "lng": r["lng"],
            "capacity": r.get("capacity") or r.get("venue_capacity"),
            "venue_id": r.get("venue_id"),
            "building": r.get("building_name") or "",
        })
    return out


@app.post("/api/places")
async def add_place(place: Place):
    try:
        row = db.add_location(place.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "id": f"place-{row['id']}",
        "name": row["name"],
        "category": row["type"],
        "description": row["description"] or "",
        "directions": row["directions"] or "",
        "lat": row["lat"],
        "lng": row["lng"],
    }


@app.delete("/api/places/{place_id}")
async def delete_place(place_id: str):
    try:
        loc_id = int(place_id.replace("place-", ""))
    except ValueError:
        raise HTTPException(status_code=404, detail="Place not found.")
    if not db.delete_location(loc_id):
        raise HTTPException(status_code=404, detail="Place not found.")
    return {"message": "Location deleted successfully."}


# ---------------------------------------------------------------------------
# Config & overview
# ---------------------------------------------------------------------------

@app.get("/api/config")
async def get_config():
    return {
        "has_gemini_key": bool(os.environ.get("GEMINI_API_KEY")),
        "mapbox_token": os.environ.get("NEXT_PUBLIC_MAPBOX_TOKEN")
        or os.environ.get("MAPBOX_TOKEN") or "",
        "mapbox_style": os.environ.get("MAPBOX_STYLE", ""),
    }


@app.get("/api/overview")
async def overview():
    return db.get_overview()


@app.get("/api/venues")
async def venues():
    return db.list_venues_with_status()


@app.get("/api/me/classes")
async def my_classes(user=Depends(get_current_user)):
    return db.student_schedule(user)


@app.get("/api/classes")
async def all_classes():
    return db.list_classes()


# ---------------------------------------------------------------------------
# Chat assistant (intent -> database lookup, anti-hallucination)
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat_assistant(chat_query: ChatQuery):
    query = chat_query.query.strip()
    api_key = chat_query.api_key or os.environ.get("GEMINI_API_KEY")

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    db_places = db.list_locations()

    # Gemini-backed grounded lookup (only ever answers from GSU records)
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')

            places_summary = [
                {
                    "id": f"place-{p['id']}",
                    "name": p["name"],
                    "category": p["type"],
                    "description": p.get("description", ""),
                    "directions": p.get("directions", ""),
                }
                for p in db_places
            ]

            prompt = (
                "You help students navigate the Gombe State University (GSU) campus.\n"
                "You are given the official list of GSU campus locations and a student's question.\n"
                "NEVER invent a location, building, or room that is not in the provided list.\n"
                "Evaluate the question and reply ONLY in this JSON format:\n"
                "{\"matchedId\": \"<location id or null>\", \"reply\": \"<friendly explanation using only provided records>\"}\n\n"
                f"Known locations: {json.dumps(places_summary)}\n\n"
                f"Student Question: \"{query}\""
            )

            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            result = json.loads(response.text.strip())
            return result
        except Exception as e:
            logger.error(f"Gemini LLM error: {e}")

    # Offline NLP keyword/fuzzy search fallback
    best_match = None
    max_score = 0
    q = query.lower()

    synonyms = {
        "Lecture Theatre": ["classroom", "hall", "lecture", "lt", "theatre"],
        "Restaurant": ["eat", "food", "restaurant", "canteen", "lunch", "cafeteria", "masa", "tuwo"],
        "Library": ["book", "read", "study", "library"],
        "Clinic": ["sick", "health", "clinic", "hospital", "doctor", "medicine"],
        "Hostel": ["sleep", "hostel", "dorm", "hall of residence"],
        "Sports": ["sport", "football", "play", "gym", "pitch", "basketball"],
    }

    for p in db_places:
        score = 0
        name = p["name"].lower()
        desc = p.get("description", "").lower()
        cat = p["type"].lower()
        directions = p.get("directions", "").lower()

        for category_name, words in synonyms.items():
            if any(w in q for w in words) and p["type"] == category_name:
                score += 2

        for word in q.split():
            if len(word) > 2:
                if word in name:
                    score += 3
                if word in desc:
                    score += 1
                if word in directions:
                    score += 0.5

        if score > max_score:
            max_score = score
            best_match = p

    if best_match and max_score > 0:
        reply = f"I found \"{best_match['name']}\". "
        if best_match.get("directions"):
            reply += best_match["directions"]
        elif best_match.get("description"):
            reply += best_match["description"]
        else:
            reply += f"It is classified under \"{best_match['type']}\"."
        return {"matchedId": f"place-{best_match['id']}", "reply": reply}

    default_reply = "I couldn't find a specific place matching that query. "
    if any(h in q for h in ["hello", "hi", "hey"]):
        default_reply = "Hello there! How can I help you find your way around Gombe State University today?"
    else:
        default_reply += "Try asking for 'Library', 'Senate Building', or a lecture theatre."

    return {"matchedId": None, "reply": default_reply}


# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------

app.mount("/", StaticFiles(directory=".", html=True), name="static")