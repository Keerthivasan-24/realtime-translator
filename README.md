# Realtime Translator

Live video call with AI-powered real-time subtitles.

## Stack
- **Frontend**: React + Vite, WebRTC (native), WebSocket
- **Backend**: FastAPI, Faster-Whisper (STT), MarianMT (translation)
- **Signaling**: WebSocket rooms (built into the backend)

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open two browser tabs (or two machines on the same network), enter the same Room ID, and start talking.

## How It Works

1. Both peers connect to the same room via WebSocket.
2. WebRTC offer/answer/ICE is relayed through the backend signaling server.
3. Each peer's mic audio is chunked (every 500ms) and sent as binary frames to the backend.
4. The backend runs Faster-Whisper (STT) → MarianMT (translation) and pushes subtitle events back to the other peer.
5. Subtitles are rendered as a CSS overlay on the remote video.

## Language Pairs Supported
en↔es, en↔fr, en↔de, en↔zh (see `backend/translate.py` to add more)

## Notes
- First run downloads Whisper and MarianMT models (~500MB total).
- For GPU acceleration: change `device="cpu"` to `device="cuda"` in `stt.py`.
- For production: replace the STUN-only ICE config with a TURN server.
