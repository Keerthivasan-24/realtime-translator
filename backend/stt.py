"""
STT via Deepgram API — free tier: $200 credits, no credit card needed.
Sign up at https://deepgram.com to get a free API key.
"""
import os
import io
import struct
import httpx

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")

# Deepgram language codes (ISO 639-1 → Deepgram)
DEEPGRAM_LANG = {
    "en": "en-US",
    "ta": "ta",
    "hi": "hi",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "zh": "zh-CN",
    "ja": "ja",
    "ar": "ar",
    "pt": "pt-BR",
    "ru": "ru",
}


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
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


async def transcribe_chunk(audio_bytes: bytes, src_lang: str = "en", sample_rate: int = 16000) -> str:
    if not DEEPGRAM_API_KEY:
        print("[STT] No DEEPGRAM_API_KEY set", flush=True)
        return ""
    if len(audio_bytes) < 2000:
        return ""

    wav_bytes = _pcm_to_wav(audio_bytes, sample_rate)
    dg_lang = DEEPGRAM_LANG.get(src_lang, src_lang)

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"https://api.deepgram.com/v1/listen"
            f"?model=nova-2"
            f"&language={dg_lang}"
            f"&smart_format=true"
            f"&punctuate=true"
            f"&filler_words=false",
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "audio/wav",
            },
            content=wav_bytes,
        )
        if resp.status_code == 200:
            data = resp.json()
            try:
                transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
                confidence = data["results"]["channels"][0]["alternatives"][0].get("confidence", 0)
                print(f"[STT] lang={dg_lang} confidence={confidence:.2f} transcript='{transcript}'", flush=True)
                # Skip low-confidence results
                if confidence < 0.5:
                    return ""
                return transcript.strip()
            except (KeyError, IndexError):
                return ""
        else:
            print(f"[STT API] status={resp.status_code} error={resp.text[:200]}", flush=True)
        return ""
