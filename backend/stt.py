"""
STT via OpenAI Whisper API — no local model, no memory issues.
Falls back to empty string if no API key is set.
"""
import os
import io
import struct
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw 16-bit mono PCM bytes in a WAV container."""
    num_samples = len(pcm_bytes) // 2
    wav_buf = io.BytesIO()
    # WAV header
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
    """Transcribe PCM audio using OpenAI Whisper API."""
    if not OPENAI_API_KEY or len(audio_bytes) < 1000:
        return ""

    wav_bytes = _pcm_to_wav(audio_bytes, sample_rate)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            files={"file": ("audio.wav", wav_bytes, "audio/wav")},
            data={"model": "whisper-1"},
        )
        if resp.status_code == 200:
            return resp.json().get("text", "").strip()
        return ""
