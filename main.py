import os
import json
import uuid
import logging
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

# Load local environment variables securely from .env file
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gsu-wayfinder-backend")

# Define Data Path
DB_PATH = "database.json"

# Base Data Seed
SEED_PLACES = [
  {
    "id": "seed-senate",
    "name": "Senate Building (VC's Office)",
    "category": "Office",
    "description": "The primary administrative hub of Gombe State University, housing the Vice Chancellor's office, registry, and academic affairs division.",
    "directions": "From the Main Gate, follow the main driveway straight for about 200 meters. The imposing Senate Building is located on your right, past the roundabout.",
    "lat": 10.304200,
    "lng": 11.172800
  },
  {
    "id": "seed-gate",
    "name": "Main Campus Gate",
    "category": "Other",
    "description": "The primary vehicle and pedestrian entrance/exit point of the GSU campus.",
    "directions": "Located along the main bypass highway. Security personnel are stationed here 24/7.",
    "lat": 10.302500,
    "lng": 11.171200
  },
  {
    "id": "seed-library",
    "name": "University Central Library",
    "category": "Library",
    "description": "The main academic resource center, offering physical books, digital library terminals, quiet study halls, and reference materials.",
    "directions": "From the Senate Building roundabout, take the left path. Walk past the Faculty of Science, and the Library will be the large multi-story structure on your right.",
    "lat": 10.305100,
    "lng": 11.174000
  },
  {
    "id": "gsu-lt1",
    "name": "Lecture Theatre 1 (LT1)",
    "category": "Lecture Theatre",
    "description": "Large capacity lecture hall 1 used for major GSU undergraduate lectures, exams, and departmental meetings.",
    "directions": "Walk 150m northeast of the Senate Building. The LT1 building is adjacent to the science block walkway.",
    "lat": 10.304800,
    "lng": 11.173000
  },
  {
    "id": "gsu-lt2",
    "name": "Lecture Theatre 2 (LT2)",
    "category": "Lecture Theatre",
    "description": "Large capacity lecture hall 2 hosting science lectures and university-wide public events.",
    "directions": "Located directly adjacent to LT1, northeast of the Senate Building.",
    "lat": 10.304900,
    "lng": 11.173200
  },
  {
    "id": "gsu-science-complex",
    "name": "Faculty of Science Complex",
    "category": "Office",
    "description": "The main science academic block containing classrooms, departmental offices, laboratories, and the major Science Lecture Theatres: SLTA and SLTB.",
    "directions": "Located 180m northeast of the Senate Building roundabout, housing the Biology, Chemistry, and Physics departments.",
    "lat": 10.305000,
    "lng": 11.173500
  },
  {
    "id": "seed-clinic",
    "name": "University Health Clinic",
    "category": "Clinic",
    "description": "Campus healthcare clinic providing primary medical consultations, emergency first aid, pharmacy services, and health advice for students.",
    "directions": "Located on the southern campus loop. Pass the male hostels and turn right; the clinic is the single-story building marked with a red cross sign.",
    "lat": 10.303300,
    "lng": 11.174500
  },
  {
    "id": "seed-fass",
    "name": "Faculty of Arts & Social Sciences (FASS)",
    "category": "Office",
    "description": "Dean's office, department offices (History, Political Science, Sociology, English), and faculty-specific classrooms.",
    "directions": "Take the western campus pathway from the main gate. The FASS complex is the second block on the left side of the lane.",
    "lat": 10.303800,
    "lng": 11.170500
  },
  {
    "id": "seed-cafeteria",
    "name": "Central Student Cafeteria",
    "category": "Restaurant",
    "description": "Food court with local vendors serving Jollof rice, Masa, Tuwo, snacks, and refreshing drinks at student-friendly prices.",
    "directions": "Situated in the central campus square, directly opposite the student center building.",
    "lat": 10.304500,
    "lng": 11.171800
  },
  {
    "id": "seed-hostel-male",
    "name": "Main Male Hostel Block",
    "category": "Hostel",
    "description": "Residential block providing accommodation for male students of Gombe State University.",
    "directions": "Located at the south-eastern boundary of the campus, close to the sports ground.",
    "lat": 10.302800,
    "lng": 11.175200
  },
  {
    "id": "seed-hostel-female",
    "name": "Main Female Hostel Complex",
    "category": "Hostel",
    "description": "Secure residential compound for female students, featuring individual halls and a common room.",
    "directions": "Located near the university clinic on the south side of campus. Access is gated and highly secured.",
    "lat": 10.303100,
    "lng": 11.173900
  },
  {
    "id": "seed-sports",
    "name": "University Sports Complex",
    "category": "Sports",
    "description": "Campus sports facilities including a football pitch, basketball court, running track, and volleyball facilities.",
    "directions": "Located at the eastern edge of the university campus. Follow the signs from the male hostels.",
    "lat": 10.302500,
    "lng": 11.176200
  },
  {
    "id": "gsu-law",
    "name": "Faculty of Law Complex",
    "category": "Office",
    "description": "Modern lecture theatres, mock trial rooms, and department offices for Law students at Gombe State University.",
    "directions": "Situated on the northern academic loop road, just north-west of the main Library complex.",
    "lat": 10.305500,
    "lng": 11.172500
  },
  {
    "id": "gsu-pharmacy",
    "name": "Faculty of Pharmaceutical Sciences Complex",
    "category": "Office",
    "description": "Contains research labs, compounding rooms, and classrooms for Pharmacy students.",
    "directions": "Located on the south-east side of campus, walk past the University clinic towards the sports field.",
    "lat": 10.303500,
    "lng": 11.175000
  },
  {
    "id": "gsu-education",
    "name": "Faculty of Education Complex",
    "category": "Office",
    "description": "Administrative offices, educational research labs, and classrooms for the Faculty of Education.",
    "directions": "Located on the eastern side of the campus loop road.",
    "lat": 10.304600,
    "lng": 11.175500
  },
  {
    "id": "gsu-medical-acad",
    "name": "Academic Building for Medical Sciences",
    "category": "Office",
    "description": "State-of-the-art building housing laboratories, classrooms, and offices for Anatomy, Physiology, and MBBS students.",
    "directions": "Located directly adjacent to the University Health Clinic on the southern loop.",
    "lat": 10.303100,
    "lng": 11.174600
  },
  {
    "id": "gsu-botanical",
    "name": "GSU Botanical Garden",
    "category": "Other",
    "description": "Tranquil green reserve area containing native plants, study benches, and research flora.",
    "directions": "Located at the far western boundary of GSU campus, past the FASS building complex.",
    "lat": 10.303500,
    "lng": 11.169500
  },
  {
    "id": "gsu-ict",
    "name": "Central ICT Center",
    "category": "Library",
    "description": "E-learning computer labs, university server rooms, and internet access center for registration and online exams.",
    "directions": "Situated just north of the University Central Library, walking distance from the science complex.",
    "lat": 10.305300,
    "lng": 11.174200
  },
  {
    "id": "gsu-theatre",
    "name": "250-Capacity Drama Theatre",
    "category": "Lecture Theatre",
    "description": "Performance arts theatre hosting cultural activities, drama student rehearsals, and departmental presentations.",
    "directions": "Located right next to the Faculty of Arts & Social Sciences (FASS) block.",
    "lat": 10.303900,
    "lng": 11.1708
  }
]

# Database IO functions
def read_db() -> List[dict]:
    if not os.path.exists(DB_PATH):
        with open(DB_PATH, "w") as f:
            json.dump(SEED_PLACES, f, indent=2)
        return SEED_PLACES
    try:
        with open(DB_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read database: {e}")
        return SEED_PLACES

def write_db(data: List[dict]):
    try:
        with open(DB_PATH, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write database: {e}")
        raise HTTPException(status_code=500, detail="Database write error.")

# FastAPI Init
app = FastAPI(
    title="CampusPilot AI API",
    description="Backend API for Gombe State University Campus navigator.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Place Models
class Place(BaseModel):
    name: str
    category: str
    description: Optional[str] = ""
    directions: Optional[str] = ""
    lat: float
    lng: float

class ChatQuery(BaseModel):
    query: str
    api_key: Optional[str] = None

# API Endpoints
@app.get("/api/places")
async def get_places():
    return read_db()

@app.post("/api/places")
async def add_place(place: Place):
    db_data = read_db()
    new_place = place.dict()
    new_place["id"] = f"place-{int(uuid.uuid4().time_low)}"
    db_data.append(new_place)
    write_db(db_data)
    return new_place

@app.delete("/api/places/{place_id}")
async def delete_place(place_id: str):
    db_data = read_db()
    updated_data = [p for p in db_data if p["id"] != place_id]
    if len(updated_data) == len(db_data):
        raise HTTPException(status_code=404, detail="Place not found.")
    write_db(updated_data)
    return {"message": "Location deleted successfully."}

@app.get("/api/config")
async def get_config():
    return {
        "has_gemini_key": bool(os.environ.get("GEMINI_API_KEY"))
    }

@app.post("/api/chat")
async def chat_assistant(chat_query: ChatQuery):
    query = chat_query.query.strip()
    api_key = chat_query.api_key or os.environ.get("GEMINI_API_KEY")
    
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    db_places = read_db()

    # If Gemini API Key is available, use real RAG
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            places_summary = [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "category": p["category"],
                    "description": p.get("description", ""),
                    "directions": p.get("directions", "")
                }
                for p in db_places
            ]
            
            prompt = (
                "You help students navigate the Gombe State University (GSU) campus.\n"
                "You are given a list of GSU campus locations and a student's question.\n"
                "Evaluate the question. You support two actions:\n"
                "1. Finding locations: Reply in this format:\n"
                "   {\"matchedId\": \"<location id or null>\", \"reply\": \"<friendly explanation>\"}\n"
                "2. Adding/registering a location: If the user asks to add, save, or register a new campus place and provides details (especially coordinate numbers for latitude and longitude, and a name), reply in this format:\n"
                "   {\"action\": \"add_place\", \"place_data\": {\"name\": \"<Name>\", \"category\": \"<Office/Lecture Theatre/Hostel/Library/Restaurant/Sports/Other>\", \"description\": \"<description>\", \"directions\": \"<directions>\", \"lat\": <float>, \"lng\": <float>}, \"reply\": \"<friendly success message confirming details>\"}\n"
                "   If they ask to add a place but did not specify coordinates (latitude and longitude), set 'matchedId' to null and reply asking them to provide coordinates or use the '+ Place' tab to drop a pin.\n\n"
                f"Known locations: {json.dumps(places_summary)}\n\n"
                f"Student Question: \"{query}\""
            )
            
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            result = json.loads(response.text.strip())
            
            if result.get("action") == "add_place" and result.get("place_data"):
                pd = result["place_data"]
                if pd.get("name") and pd.get("lat") and pd.get("lng"):
                    new_id = f"place-{int(uuid.uuid4().time_low)}"
                    new_place = {
                        "id": new_id,
                        "name": pd["name"],
                        "category": pd.get("category", "Other"),
                        "description": pd.get("description", ""),
                        "directions": pd.get("directions", ""),
                        "lat": float(pd["lat"]),
                        "lng": float(pd["lng"])
                    }
                    db_data = read_db()
                    db_data.append(new_place)
                    write_db(db_data)
                    result["matchedId"] = new_id
            
            return result
        except Exception as e:
            logger.error(f"Gemini LLM error: {e}")
            # Fall back to local search if LLM fails

    # Offline NLP Keyword/Fuzzy search fallback (executed in Python)
    best_match = None
    max_score = 0
    q = query.lower()

    # Category associations
    synonyms = {
        "Lecture Theatre": ["classroom", "hall", "lecture", "lt", "theatre", "hall 1", "hall 2"],
        "Restaurant": ["eat", "food", "restaurant", "canteen", "lunch", "cafeteria", "masa", "tuwo"],
        "Library": ["book", "read", "study", "library"],
        "Clinic": ["sick", "health", "clinic", "hospital", "doctor", "medicine"],
        "Hostel": ["sleep", "hostel", "dorm", "hall of residence"],
        "Sports": ["sport", "football", "play", "gym", "pitch", "basketball"]
    }

    for p in db_places:
        score = 0
        name = p["name"].lower()
        desc = p.get("description", "").lower()
        cat = p["category"].lower()
        directions = p.get("directions", "").lower()

        # Score category matches
        for category_name, words in synonyms.items():
            if any(w in q for w in words) and p["category"] == category_name:
                score += 2

        # Word overlaps
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
            reply += f"It is classified under \"{best_match['category']}\"."
            
        if not api_key:
            reply += "\n\n(💡 Note: Save a Gemini API Key under the 🔒 Settings icon to activate real-time LLM replies)."
            
        return {"matchedId": best_match["id"], "reply": reply}

    # Default fallback response
    default_reply = "I couldn't find a specific place matching that query. "
    if any(h in q for h in ["hello", "hi", "hey"]):
        default_reply = "Hello there! How can I help you find your way around Gombe State University today?"
    else:
        default_reply += "Try asking for 'Library', 'Senate Building', or 'Faculty of Science', or add a spot yourself under the '+ Place' tab."

    if not api_key:
        default_reply += "\n\n(💡 Note: Save a Gemini API Key under the 🔒 Settings icon to activate real-time LLM replies)."

    return {"matchedId": None, "reply": default_reply}

# Mount static files to serve frontend client
app.mount("/", StaticFiles(directory=".", html=True), name="static")
