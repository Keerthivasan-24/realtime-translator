"""
FastAPI backend — handles:
  1. WebRTC signaling (offer/answer/ICE) via WebSocket rooms
  2. Audio chunk ingestion + STT + translation via WebSocket
  3. Post-call: summary, action items, and transcript export
"""
import json
import asyncio
from typing import Dict, List, Set
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from stt import transcribe_chunk
from translate import translate
from llm import generate_summary, extract_action_items
from export import build_txt, build_pdf, export_to_notion, export_to_slack

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ───────────────────────────────────────────────────────────
# rooms[room_id] = set of WebSocket connections (max 2 peers)
rooms: Dict[str, Set[WebSocket]] = {}

# transcripts[room_id] = list of transcript entries
transcripts: Dict[str, List[dict]] = {}

# peer labels: first joiner = "A", second = "B"
peer_labels: Dict[str, Dict[WebSocket, str]] = {}


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


async def broadcast_to_others(room_id: str, sender: WebSocket, message: str):
    for ws in list(rooms.get(room_id, [])):
        if ws is not sender:
            try:
                await ws.send_text(message)
            except Exception:
                pass


# ── WebSocket: signaling + audio ──────────────────────────────────────────────
@app.websocket("/ws/{room_id}")
async def room_ws(websocket: WebSocket, room_id: str):
    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = set()
        transcripts[room_id] = []
        peer_labels[room_id] = {}

    if len(rooms[room_id]) >= 2:
        await websocket.send_text(json.dumps({"type": "error", "message": "Room is full"}))
        await websocket.close()
        return

    rooms[room_id].add(websocket)
    label = "A" if len(rooms[room_id]) == 1 else "B"
    peer_labels[room_id][websocket] = label

    await websocket.send_text(json.dumps({
        "type": "joined",
        "shouldInitiate": len(rooms[room_id]) == 2,
        "peerCount": len(rooms[room_id]),
        "label": label,
    }))
    await broadcast_to_others(room_id, websocket, json.dumps({"type": "peer_joined"}))

    async def keepalive():
        """Send a ping every 20s to prevent Render's proxy from closing the WS."""
        while True:
            await asyncio.sleep(20)
            try:
                await websocket.send_text(json.dumps({"type": "ping"}))
            except Exception:
                break

    ping_task = asyncio.create_task(keepalive())

    try:
        while True:
            raw = await websocket.receive()

            # ── Binary frame → audio chunk ────────────────────────────────
            if "bytes" in raw and raw["bytes"]:
                audio_bytes = raw["bytes"]

                if len(audio_bytes) > 5:
                    lang_header = audio_bytes[:5].decode("utf-8", errors="ignore")
                    pcm_data = audio_bytes[5:]
                    parts = lang_header.strip().split("-")
                    src_lang = parts[0] if len(parts) >= 1 else "en"
                    tgt_lang = parts[1] if len(parts) >= 2 else "es"
                else:
                    pcm_data = audio_bytes
                    src_lang, tgt_lang = "en", "es"

                # Speaker label: use peer label (A/B) or custom from meeting mode
                speaker_label = peer_labels[room_id].get(websocket, "?")

                transcript_text = await transcribe_chunk(pcm_data)

                if transcript_text:
                    translated_text = await translate(transcript_text, src_lang, tgt_lang)

                    # Store in transcript log
                    entry = {
                        "timestamp": _ts(),
                        "speaker": speaker_label,
                        "text": transcript_text,
                        "translated": translated_text,
                        "src": src_lang,
                        "tgt": tgt_lang,
                    }
                    transcripts[room_id].append(entry)

                    # Send subtitle to the other peer
                    await broadcast_to_others(room_id, websocket, json.dumps({
                        "type": "subtitle",
                        **entry,
                    }))

            # ── Text frame → WebRTC signaling ─────────────────────────────
            elif "text" in raw and raw["text"]:
                msg = json.loads(raw["text"])
                if msg.get("type") in ("offer", "answer", "ice-candidate"):
                    await broadcast_to_others(room_id, websocket, raw["text"])

    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        rooms[room_id].discard(websocket)
        peer_labels[room_id].pop(websocket, None)
        if not rooms[room_id]:
            del rooms[room_id]
            del peer_labels[room_id]
            # Keep transcript in memory for post-call export (cleaned up on /transcript/clear)
        await broadcast_to_others(room_id, websocket, json.dumps({"type": "peer_left"}))


# ── REST: post-call analysis ──────────────────────────────────────────────────

@app.get("/transcript/{room_id}")
def get_transcript(room_id: str):
    entries = transcripts.get(room_id, [])
    return {"room_id": room_id, "entries": entries, "count": len(entries)}


@app.get("/summary/{room_id}")
async def get_summary(room_id: str):
    entries = transcripts.get(room_id, [])
    if not entries:
        raise HTTPException(404, "No transcript found for this room")
    summary = await generate_summary(entries)
    action_items = await extract_action_items(entries)
    return {"summary": summary, "action_items": action_items}


# ── REST: export ──────────────────────────────────────────────────────────────

@app.get("/export/{room_id}/txt")
async def export_txt(room_id: str):
    entries = transcripts.get(room_id, [])
    summary = await generate_summary(entries)
    action_items = await extract_action_items(entries)
    content = build_txt(room_id, entries, summary, action_items)
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="transcript-{room_id}.txt"'},
    )


@app.get("/export/{room_id}/pdf")
async def export_pdf(room_id: str):
    entries = transcripts.get(room_id, [])
    summary = await generate_summary(entries)
    action_items = await extract_action_items(entries)
    content = build_pdf(room_id, entries, summary, action_items)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="transcript-{room_id}.pdf"'},
    )


class NotionExportRequest(BaseModel):
    notion_token: str
    database_id: str


@app.post("/export/{room_id}/notion")
async def export_notion(room_id: str, body: NotionExportRequest):
    entries = transcripts.get(room_id, [])
    loop = asyncio.get_event_loop()
    summary = await loop.run_in_executor(None, generate_summary, entries)
    action_items = await loop.run_in_executor(None, extract_action_items, entries)
    url = await export_to_notion(room_id, entries, summary, action_items,
                                  body.notion_token, body.database_id)
    return {"url": url}


class SlackExportRequest(BaseModel):
    webhook_url: str


@app.post("/export/{room_id}/slack")
async def export_slack(room_id: str, body: SlackExportRequest):
    entries = transcripts.get(room_id, [])
    loop = asyncio.get_event_loop()
    summary = await loop.run_in_executor(None, generate_summary, entries)
    action_items = await loop.run_in_executor(None, extract_action_items, entries)
    await export_to_slack(room_id, summary, action_items, body.webhook_url)
    return {"status": "sent"}


@app.delete("/transcript/{room_id}")
def clear_transcript(room_id: str):
    transcripts.pop(room_id, None)
    return {"status": "cleared"}
