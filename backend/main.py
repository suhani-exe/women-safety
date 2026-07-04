"""
ShieldHer — Main FastAPI Application
All API routes in one file for hackathon simplicity.
"""

import os
import uuid
import requests
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()

from database import (
    init_db, create_user, get_user_by_email, get_user_by_id, update_user,
    add_contact, get_contacts, delete_contact,
    create_incident, get_incidents, resolve_incident,
    create_report, get_heatmap_data,
    create_safewalk, get_active_safewalk, end_safewalk
)
from auth import hash_password, verify_password, create_token, get_current_user_id
from gemini_service import analyze_transcript, analyze_audio_file

# ============================================
# App Setup
# ============================================

app = FastAPI(
    title="ShieldHer API",
    description="Women Safety & Empowerment App — Hackathon Edition",
    version="1.0.0"
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize database on startup
@app.on_event("startup")
def startup():
    init_db()
    print("🛡️ ShieldHer API is running!")


# ============================================
# Pydantic Models (Request/Response schemas)
# ============================================

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    safe_word: Optional[str] = None

class ContactRequest(BaseModel):
    name: str
    phone: str
    relationship: Optional[str] = None

class TranscriptRequest(BaseModel):
    transcript: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class EmergencyRequest(BaseModel):
    latitude: float
    longitude: float
    type: str = "manual"  # manual, audio, shake
    transcript: Optional[str] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class ReportRequest(BaseModel):
    latitude: float
    longitude: float
    description: Optional[str] = None
    category: Optional[str] = None  # harassment, stalking, unsafe_area, poor_lighting, other

class SafeWalkRequest(BaseModel):
    dest_name: str
    dest_lat: float
    dest_lng: float
    eta_minutes: int  # how many minutes until expected arrival


# ============================================
# Auth Routes
# ============================================

@app.post("/api/register")
def register(req: RegisterRequest):
    """Create a new user account."""
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(req.password)
    user = create_user(req.name, req.email, hashed, req.phone)
    token = create_token(user["id"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone")
        }
    }


@app.post("/api/login")
def login(req: LoginRequest):
    """Login with email and password."""
    user = get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["id"])

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone"),
            "safe_word": user.get("safe_word")
        }
    }


@app.get("/api/me")
def get_profile(user_id: int = Depends(get_current_user_id)):
    """Get current user's profile."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


@app.put("/api/me")
def update_profile(req: UpdateProfileRequest, user_id: int = Depends(get_current_user_id)):
    """Update current user's profile."""
    user = update_user(user_id, req.name, req.phone, req.safe_word)
    return {"user": user}


# ============================================
# Emergency Contacts Routes
# ============================================

@app.get("/api/contacts")
def list_contacts(user_id: int = Depends(get_current_user_id)):
    """Get all emergency contacts for current user."""
    contacts = get_contacts(user_id)
    return {"contacts": contacts}


@app.post("/api/contacts")
def create_contact(req: ContactRequest, user_id: int = Depends(get_current_user_id)):
    """Add a new emergency contact."""
    contact = add_contact(user_id, req.name, req.phone, req.relationship)
    return {"contact": contact}


@app.delete("/api/contacts/{contact_id}")
def remove_contact(contact_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete an emergency contact."""
    success = delete_contact(contact_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}


# ============================================
# Shield Mode — Audio Analysis Routes
# ============================================

@app.post("/api/audio/analyze")
def analyze_audio_transcript(req: TranscriptRequest, user_id: int = Depends(get_current_user_id)):
    """
    Analyze a text transcript (from Web Speech API) for threats.
    This is the primary analysis endpoint — browser transcribes, we analyze.
    """
    result = analyze_transcript(req.transcript)

    # Log if suspicious or dangerous
    if result["threat_level"] in ["SUSPICIOUS", "DANGER"]:
        create_incident(
            user_id=user_id,
            incident_type="audio",
            threat_level=result["threat_level"],
            transcript=req.transcript,
            lat=req.latitude,
            lng=req.longitude
        )

    return {"analysis": result}


@app.post("/api/audio/upload")
async def upload_and_analyze_audio(
    audio: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    user_id: int = Depends(get_current_user_id)
):
    """
    Upload an audio file and analyze it directly with Gemini (multimodal).
    Alternative to transcript-based analysis.
    """
    # Save the audio file
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}_{audio.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await audio.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Analyze with Gemini
    result = analyze_audio_file(filepath)

    # Log if suspicious or dangerous
    if result.get("threat_level") in ["SUSPICIOUS", "DANGER"]:
        create_incident(
            user_id=user_id,
            incident_type="audio",
            threat_level=result["threat_level"],
            transcript=result.get("transcript", ""),
            lat=latitude,
            lng=longitude
        )

    return {
        "analysis": result,
        "audio_file": filename
    }


@app.get("/api/audio/history")
def get_audio_history(user_id: int = Depends(get_current_user_id)):
    """Get past incident logs."""
    incidents_list = get_incidents(user_id)
    return {"incidents": incidents_list}


# ============================================
# Emergency Protocol Routes
# ============================================

@app.post("/api/emergency/trigger")
def trigger_emergency(req: EmergencyRequest, user_id: int = Depends(get_current_user_id)):
    """
    Trigger the emergency protocol.
    Logs the incident and returns contact info for the frontend to make calls/messages.
    """
    # Log the incident
    incident = create_incident(
        user_id=user_id,
        incident_type=req.type,
        threat_level="DANGER",
        transcript=req.transcript,
        lat=req.latitude,
        lng=req.longitude
    )

    # Get emergency contacts
    contacts = get_contacts(user_id)

    # Get user info
    user = get_user_by_id(user_id)

    # Build the SOS message
    maps_link = f"https://www.google.com/maps?q={req.latitude},{req.longitude}"
    sos_message = (
        f"🚨 EMERGENCY SOS from {user['name']}!\n"
        f"They need immediate help!\n"
        f"📍 Location: {maps_link}\n"
        f"Time: {datetime.now().strftime('%I:%M %p, %b %d %Y')}\n"
        f"Type: {req.type}\n"
        f"Please call them or emergency services immediately!"
    )

    # Build WhatsApp deep links for each contact
    contact_alerts = []
    for contact in contacts:
        phone_clean = contact["phone"].replace("+", "").replace(" ", "").replace("-", "")
        whatsapp_link = f"https://wa.me/{phone_clean}?text={requests.utils.quote(sos_message)}"
        tel_link = f"tel:{contact['phone']}"

        contact_alerts.append({
            "name": contact["name"],
            "phone": contact["phone"],
            "relationship": contact.get("relationship"),
            "whatsapp_link": whatsapp_link,
            "tel_link": tel_link
        })

    return {
        "incident": incident,
        "sos_message": sos_message,
        "contacts": contact_alerts,
        "emergency_numbers": [
            {"name": "Police (India)", "phone": "100", "tel_link": "tel:100"},
            {"name": "Women Helpline", "phone": "1091", "tel_link": "tel:1091"},
            {"name": "Emergency (US)", "phone": "911", "tel_link": "tel:911"}
        ],
        "maps_link": maps_link
    }


@app.post("/api/emergency/resolve/{incident_id}")
def resolve_emergency(incident_id: int, user_id: int = Depends(get_current_user_id)):
    """Mark an incident as resolved (user is safe)."""
    incident = resolve_incident(incident_id, user_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"incident": incident}


# ============================================
# Location Routes
# ============================================

@app.post("/api/location/police")
def find_nearest_police(req: LocationUpdate):
    """Find nearest police stations using OpenStreetMap Overpass API."""
    try:
        # Overpass API query for police stations within 5km radius
        overpass_url = "https://overpass-api.de/api/interpreter"
        query = f"""
        [out:json][timeout:10];
        (
          node["amenity"="police"](around:5000,{req.latitude},{req.longitude});
          way["amenity"="police"](around:5000,{req.latitude},{req.longitude});
        );
        out center body;
        """

        response = requests.get(overpass_url, params={"data": query}, timeout=10)
        data = response.json()

        stations = []
        for element in data.get("elements", []):
            lat = element.get("lat") or element.get("center", {}).get("lat")
            lon = element.get("lon") or element.get("center", {}).get("lon")
            name = element.get("tags", {}).get("name", "Police Station")

            if lat and lon:
                stations.append({
                    "name": name,
                    "latitude": lat,
                    "longitude": lon,
                    "phone": element.get("tags", {}).get("phone", ""),
                })

        return {"stations": stations[:10]}  # Return top 10 nearest

    except Exception as e:
        print(f"⚠️ Overpass API error: {e}")
        return {"stations": [], "error": "Could not fetch police stations"}


# ============================================
# Community Safety Reports Routes
# ============================================

@app.post("/api/reports")
def submit_report(req: ReportRequest, user_id: int = Depends(get_current_user_id)):
    """Submit an anonymous safety report for the heatmap."""
    report = create_report(user_id, req.latitude, req.longitude, req.description, req.category)
    return {"report": report}


@app.get("/api/reports/heatmap")
def get_heatmap():
    """Get all safety reports for the heatmap overlay (public endpoint)."""
    reports = get_heatmap_data()
    return {"reports": reports}


# ============================================
# SafeWalk Routes
# ============================================

@app.post("/api/safewalk/start")
def start_safewalk(req: SafeWalkRequest, user_id: int = Depends(get_current_user_id)):
    """Start a SafeWalk session — virtual walking companion."""
    from datetime import timedelta
    eta = datetime.now() + timedelta(minutes=req.eta_minutes)
    walk = create_safewalk(user_id, req.dest_name, req.dest_lat, req.dest_lng, eta.isoformat())
    return {"safewalk": walk}


@app.get("/api/safewalk/active")
def get_current_safewalk(user_id: int = Depends(get_current_user_id)):
    """Get the user's current active SafeWalk."""
    walk = get_active_safewalk(user_id)
    return {"safewalk": walk}


@app.post("/api/safewalk/{walk_id}/end")
def complete_safewalk(walk_id: int, user_id: int = Depends(get_current_user_id)):
    """Mark SafeWalk as completed (reached safely)."""
    walk = end_safewalk(walk_id, user_id, "completed")
    if not walk:
        raise HTTPException(status_code=404, detail="SafeWalk not found")
    return {"safewalk": walk, "message": "Glad you reached safely! 🎉"}


# ============================================
# Health Check
# ============================================

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": "ShieldHer", "version": "1.0.0"}
