"""
STT via Deepgram API — free tier: 200 hours/month, no credit card needed.
Sign up at https://deepgram.com to get a free API key.
"""
import os
import io
import struct
import httpx

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw 16-bit mono PCM bytes in a WAV container."""
    wav_buf = io.BytesIO()
    wav_buf.write(b"RIFF")
    wav_buf.write(struct.pack("<I", 36 + len(pcm_bytes)))
    wav_buf.write(b"WAVE")
    wav_buf.write(b"fmt ")
    wav_buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate,
                              sample_rate * 2, 2, 16))
    wav_buf.write(b"data")
    wav_buf.write(struct.pack("<I", len(pcm_bytes)))
    wav_buf.write(pcm_bytes)
    return wav_buf.getvalue()


async def transcribe_chunk(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """Transcribe PCM audio using Deepgram API."""
    if not DEEPGRAM_API_KEY:
        print("[STT] No DEEPGRAM_API_KEY set", flush=True)
        return ""
    if len(audio_bytes) < 1000:
        return ""

    wav_bytes = _pcm_to_wav(audio_bytes, sample_rate)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "audio/wav",
            },
            content=wav_bytes,
        )
        print(f"[STT API] status={resp.status_code}", flush=True)
        if resp.status_code == 200:
            data = resp.json()
            try:
                transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
                print(f"[STT] transcript='{transcript}'", flush=True)
                return transcript.strip()
            except (KeyError, IndexError):
                return ""
        else:
            print(f"[STT API] error={resp.text[:200]}", flush=True)
        return ""
