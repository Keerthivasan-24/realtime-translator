"""
Translation via MyMemory API — completely free, no API key needed.
Limit: 5000 chars/day on free tier (enough for normal calls).
"""
import httpx

LANG_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French",
    "de": "German",  "zh": "Chinese", "ja": "Japanese",
    "ar": "Arabic",  "hi": "Hindi",   "pt": "Portuguese",
    "ru": "Russian", "ta": "Tamil",
}


async def translate(text: str, src_lang: str, tgt_lang: str) -> str:
    """Translate text using MyMemory free API."""
    if not text.strip() or src_lang == tgt_lang:
        return text

    # MyMemory uses full locale codes for better accuracy
    LOCALE = {
        "en": "en-US", "ta": "ta-IN", "hi": "hi-IN",
        "es": "es-ES", "fr": "fr-FR", "de": "de-DE",
        "zh": "zh-CN", "ja": "ja-JP", "ar": "ar-SA",
        "pt": "pt-BR", "ru": "ru-RU",
    }
    src = LOCALE.get(src_lang, src_lang)
    tgt = LOCALE.get(tgt_lang, tgt_lang)
    lang_pair = f"{src}|{tgt}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": lang_pair},
        )
        if resp.status_code == 200:
            data = resp.json()
            translated = data.get("responseData", {}).get("translatedText", "")
            print(f"[TRANSLATE] {src_lang}→{tgt_lang} '{text}' → '{translated}'", flush=True)
            # MyMemory returns error messages as translated text sometimes
            if translated and not translated.upper().startswith("MYMEMORY"):
                return translated
        return text
