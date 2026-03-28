"""
STT via Deepgram API — optimized for accuracy + low latency within 300MB RAM.
"""
import os
import io
import struct
import httpx

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")

DEEPGRAM_LANG = {
    "en": "en-US", "ta": "ta",    "hi": "hi",
    "es": "es",    "fr": "fr",    "de": "de",
    "zh": "zh-CN", "ja": "ja",    "ar": "ar",
    "pt": "pt-BR", "ru": "ru",
}

# Languages that need nova-3 (nova-2 doesn't support them)
NOVA3_LANGS = {"ta", "hi", "ar"}

# Tonal/complex script languages need full 16kHz — others can use 8kHz to save bandwidth
FULL_RATE_LANGS = {"zh", "ja", "ta", "hi", "ar"}


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw 16-bit mono PCM in a WAV container."""
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


def _downsample(pcm_bytes: bytes, from_rate: int = 16000, to_rate: int = 8000) -> bytes:
    """Simple decimation downsample (keep every Nth sample)."""
    step = from_rate // to_rate
    samples = struct.unpack(f"<{len(pcm_bytes)//2}h", pcm_bytes)
    downsampled = samples[::step]
    return struct.pack(f"<{len(downsampled)}h", *downsampled)


async def transcribe_chunk(audio_bytes: bytes, src_lang: str = "en", sample_rate: int = 16000) -> str:
    if not DEEPGRAM_API_KEY:
        return ""
    if len(audio_bytes) < 3000:  # skip very short clips (silence/noise)
        return ""

    # Downsample non-tonal languages to 8kHz — cuts payload ~50%, same accuracy
    if src_lang not in FULL_RATE_LANGS:
        audio_bytes = _downsample(audio_bytes, sample_rate, 8000)
        sample_rate = 8000

    wav_bytes = _pcm_to_wav(audio_bytes, sample_rate)
    dg_lang   = DEEPGRAM_LANG.get(src_lang, src_lang)
    model     = "nova-3" if src_lang in NOVA3_LANGS else "nova-2"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"https://api.deepgram.com/v1/listen"
            f"?model={model}"
            f"&language={dg_lang}"
            f"&smart_format=true"
            f"&punctuate=true"
            f"&filler_words=false"
            f"&utterances=false",
            headers={
                "Authorization": f"Token {DEEPGRAM_API_KEY}",
                "Content-Type": "audio/wav",
            },
            content=wav_bytes,
        )
        if resp.status_code == 200:
            data = resp.json()
            try:
                alt = data["results"]["channels"][0]["alternatives"][0]
                transcript  = alt.get("transcript", "").strip()
                confidence  = alt.get("confidence", 0)
                print(f"[STT] {model}/{dg_lang} conf={confidence:.2f} '{transcript}'", flush=True)
                if confidence < 0.45 or not transcript:
                    return ""
                return transcript
            except (KeyError, IndexError):
                return ""
        else:
            print(f"[STT] {resp.status_code} {resp.text[:150]}", flush=True)
        return ""
