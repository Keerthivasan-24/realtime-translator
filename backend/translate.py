"""
Translation via OpenAI GPT — lightweight, no local models.
"""
import os
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

LANG_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French",
    "de": "German",  "zh": "Chinese", "ja": "Japanese",
    "ar": "Arabic",  "hi": "Hindi",   "pt": "Portuguese", "ru": "Russian",
}


async def translate(text: str, src_lang: str, tgt_lang: str) -> str:
    """Translate text using OpenAI GPT-4o-mini."""
    if not text.strip() or src_lang == tgt_lang:
        return text
    if not OPENAI_API_KEY:
        return f"[Translation unavailable — set OPENAI_API_KEY] {text}"

    src = LANG_NAMES.get(src_lang, src_lang)
    tgt = LANG_NAMES.get(tgt_lang, tgt_lang)

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                     "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": f"Translate from {src} to {tgt}. Return only the translated text, nothing else."},
                    {"role": "user", "content": text},
                ],
                "max_tokens": 200,
                "temperature": 0.3,
            },
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
        return text
