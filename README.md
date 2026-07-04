# ShieldHer 🛡️ — Women Safety & Empowerment App

AI-powered women's safety app with real-time threat detection, emergency alerts, and community features. Built for hackathons.

## Features

- 🎙️ **AI Shield Mode** — Real-time audio analysis with Gemini AI for threat detection
- 📳 **Motion Detection** — Automatic shake/impact detection triggers safety check
- 🚨 **Emergency Protocol** — One-tap SOS with WhatsApp alerts, auto-dial, live location
- 🗺️ **Safety Map** — Live location with nearest police station finder
- 🚶‍♀️ **SafeWalk** — Virtual walking companion with ETA check-in
- 📚 **Empowerment Hub** — Legal rights, helplines, financial schemes, self-defense
- 👥 **Emergency Contacts** — Manage trusted contacts for instant alerts

## Tech Stack

- **Frontend**: Vite + React
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **AI**: Google Gemini (gemini-2.0-flash)
- **Maps**: Leaflet.js + OpenStreetMap
- **Auth**: JWT

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
# Edit .env with your PostgreSQL connection and Gemini API key
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` and start using ShieldHer!

## Team

Built with 💜 for Women Empowerment & Social Inclusion