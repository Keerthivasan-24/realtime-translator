"""
Translation using multiple free APIs with fallback chain:
1. Lingva (Google Translate mirror) — best quality, free
2. MyMemory — fallback if Lingva fails
"""
import httpx

# Lingva public instances (Google Translate quality, free)
LINGVA_INSTANCES = [
    "https://lingva.ml",
    "https://lingva.thedaviddelta.com",
]

# MyMemory locale codes as fallback
MYMEMORY_LOCALE = {
    "en": "en-US", "ta": "ta-IN", "hi": "hi-IN",
    "es": "es-ES", "fr": "fr-FR", "de": "de-DE",
    "zh": "zh-CN", "ja": "ja-JP", "ar": "ar-SA",
    "pt": "pt-BR", "ru": "ru-RU",
}


async def _lingva(text: str, src: str, tgt: str) -> str:
    """Try Lingva instances (Google Translate quality)."""
    import urllib.parse
    encoded = urllib.parse.quote(text)
    for base in LINGVA_INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(f"{base}/api/v1/{src}/{tgt}/{encoded}")
                if resp.status_code == 200:
                    result = resp.json().get("translation", "").strip()
                    if result:
                        print(f"[TRANSLATE] lingva {src}→{tgt} '{text[:40]}' → '{result[:40]}'", flush=True)
                        return result
        except Exception as e:
            print(f"[TRANSLATE] lingva {base} failed: {e}", flush=True)
    return ""


async def _mymemory(text: str, src: str, tgt: str) -> str:
    """MyMemory fallback."""
    src_loc = MYMEMORY_LOCALE.get(src, src)
    tgt_loc = MYMEMORY_LOCALE.get(tgt, tgt)
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text, "langpair": f"{src_loc}|{tgt_loc}"},
            )
            if resp.status_code == 200:
                result = resp.json().get("responseData", {}).get("translatedText", "")
                if result and not result.upper().startswith("MYMEMORY"):
                    print(f"[TRANSLATE] mymemory {src}→{tgt} '{text[:40]}' → '{result[:40]}'", flush=True)
                    return result.strip()
    except Exception as e:
        print(f"[TRANSLATE] mymemory failed: {e}", flush=True)
    return ""


async def translate(text: str, src_lang: str, tgt_lang: str) -> str:
    if not text.strip() or src_lang == tgt_lang:
        return text

    # Try Lingva first (Google Translate quality)
    result = await _lingva(text, src_lang, tgt_lang)
    if result:
        return result

    # Fallback to MyMemory
    result = await _mymemory(text, src_lang, tgt_lang)
    if result:
        return result

    # Last resort: return original
    return text
