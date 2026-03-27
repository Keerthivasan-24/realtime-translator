"""
Speech-to-Text using Faster-Whisper for low-latency streaming transcription.
"""
import io
import numpy as np
from faster_whisper import WhisperModel

# Load once at startup — use "base" for speed, "small"/"medium" for accuracy
_model = None

def get_model() -> WhisperModel:
    global _model
    if _model is None:
        # device="cpu" works everywhere; switch to "cuda" if you have a GPU
        _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


def transcribe_chunk(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Transcribe a raw PCM audio chunk (16-bit, mono, 16kHz).
    Returns the transcribed text string.
    """
    model = get_model()

    # Convert raw bytes → float32 numpy array
    audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

    # faster-whisper expects a float32 numpy array
    segments, _ = model.transcribe(audio_np, language=None, vad_filter=True)
    text = " ".join(seg.text.strip() for seg in segments)
    return text.strip()
