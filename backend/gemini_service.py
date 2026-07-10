"""
ShieldHer — Gemini AI Service
Analyzes audio transcripts for potential safety threats using Google Gemini.
"""

import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# The safety analysis prompt — this is the heart of the AI feature
SAFETY_ANALYSIS_PROMPT = """You are a women's safety AI assistant. Analyze the following audio transcript for potential safety threats.

Consider these indicators of danger:
- Threatening language, aggression, or intimidation
- Someone being followed or stalked
- Harassment (verbal, physical, sexual)
- Sounds of distress, screaming, or crying
- Coercion or forced compliance
- Mentions of weapons or violence
- Someone saying they feel unsafe or scared
- Suspicious approaches by strangers
- Catcalling or verbal abuse

Respond ONLY with valid JSON in this exact format:
{
    "threat_level": "SAFE" or "SUSPICIOUS" or "DANGER",
    "confidence": 0.0 to 1.0,
    "reason": "Brief explanation of why this threat level was assigned",
    "recommended_action": "What the user should do"
}

Rules:
- If the transcript is empty, unclear, or just normal conversation, respond with SAFE.
- If there are mild concerning elements, respond with SUSPICIOUS.
- If there is clear threat or danger, respond with DANGER.
- Be sensitive — err on the side of caution for women's safety.
- Keep the reason concise (1-2 sentences max).

Audio Transcript:
\"\"\"
{transcript}
\"\"\"
"""


def analyze_transcript(transcript: str) -> dict:
    """
    Analyze an audio transcript for safety threats using Gemini.
    Returns: { threat_level, confidence, reason, recommended_action }
    """
    if not GEMINI_API_KEY:
        # Fallback for demo without API key
        return {
            "threat_level": "SAFE",
            "confidence": 0.5,
            "reason": "Gemini API key not configured — running in demo mode",
            "recommended_action": "Configure your Gemini API key for real analysis"
        }

    if not transcript or transcript.strip() == "":
        return {
            "threat_level": "SAFE",
            "confidence": 1.0,
            "reason": "No speech detected in audio",
            "recommended_action": "Continue monitoring"
        }

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = SAFETY_ANALYSIS_PROMPT.replace("{transcript}", transcript)

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature for consistent safety analysis
            )
        )

        # Parse the JSON response
        import json
        result = json.loads(response.text)

        # Validate the response has required fields
        valid_levels = ["SAFE", "SUSPICIOUS", "DANGER"]
        if result.get("threat_level") not in valid_levels:
            result["threat_level"] = "SAFE"

        return {
            "threat_level": result.get("threat_level", "SAFE"),
            "confidence": float(result.get("confidence", 0.5)),
            "reason": result.get("reason", "Analysis complete"),
            "recommended_action": result.get("recommended_action", "Stay alert")
        }

    except Exception as e:
        print(f"⚠️ Gemini analysis error: {e}")
        return {
            "threat_level": "SAFE",
            "confidence": 0.0,
            "reason": f"Analysis error: {str(e)[:100]}",
            "recommended_action": "Stay alert — AI analysis temporarily unavailable"
        }


def analyze_audio_file(audio_path: str) -> dict:
    """
    Analyze an audio file directly using Gemini's multimodal capabilities.
    This is an alternative to transcribe-then-analyze.
    
    IMPORTANT: Gemini Files API requires polling until the file reaches
    ACTIVE state before it can be used in generate_content.
    """
    import time
    import json

    if not GEMINI_API_KEY:
        return {
            "threat_level": "SAFE",
            "confidence": 0.5,
            "reason": "Gemini API key not configured — running in demo mode",
            "recommended_action": "Configure your Gemini API key"
        }

    uploaded_file = None
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Upload the file to Gemini Files API
        print(f"📤 Uploading audio file: {audio_path}")
        uploaded_file = genai.upload_file(audio_path)

        # --- FIX: Poll until the file is ACTIVE (not PROCESSING) ---
        # Without this, generate_content receives a file that isn't ready
        # and silently fails or throws an error.
        max_wait = 60  # seconds
        waited = 0
        while uploaded_file.state.name == "PROCESSING":
            if waited >= max_wait:
                raise TimeoutError("Gemini file processing timed out after 60s")
            print(f"⏳ File processing... waiting ({waited}s)")
            time.sleep(3)
            waited += 3
            uploaded_file = genai.get_file(uploaded_file.name)

        if uploaded_file.state.name == "FAILED":
            raise ValueError(f"Gemini file processing failed: {uploaded_file.state}")

        print(f"✅ File is ACTIVE, running analysis...")

        prompt = """Analyze this audio recording for women's safety threats. Listen for:
- Threatening language, aggression, intimidation
- Harassment or catcalling
- Sounds of distress
- Suspicious or dangerous situations

Respond ONLY with valid JSON (no markdown, no code fences):
{
    "threat_level": "SAFE",
    "confidence": 0.0,
    "transcript": "What was said in the audio",
    "reason": "Brief explanation",
    "recommended_action": "What user should do"
}

threat_level must be exactly one of: SAFE, SUSPICIOUS, or DANGER."""

        response = model.generate_content(
            [prompt, uploaded_file],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            )
        )

        result = json.loads(response.text)

        valid_levels = ["SAFE", "SUSPICIOUS", "DANGER"]
        if result.get("threat_level") not in valid_levels:
            result["threat_level"] = "SAFE"

        # Normalize to always have required fields
        return {
            "threat_level": result.get("threat_level", "SAFE"),
            "confidence": float(result.get("confidence", 0.5)),
            "transcript": result.get("transcript", ""),
            "reason": result.get("reason", "Analysis complete"),
            "recommended_action": result.get("recommended_action", "Stay alert"),
        }

    except Exception as e:
        print(f"⚠️ Gemini audio analysis error: {e}")
        return {
            "threat_level": "SAFE",
            "confidence": 0.0,
            "transcript": "",
            "reason": f"Audio analysis error: {str(e)[:200]}",
            "recommended_action": "Stay alert — AI audio analysis temporarily unavailable"
        }
    finally:
        # Clean up: delete the uploaded file from Gemini Files API
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
                print(f"🗑️ Deleted uploaded file from Gemini: {uploaded_file.name}")
            except Exception:
                pass  # non-critical
