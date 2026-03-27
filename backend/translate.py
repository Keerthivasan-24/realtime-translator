"""
Translation using Helsinki-NLP MarianMT models from Hugging Face.
Models are downloaded on first use and cached locally.
"""
from transformers import MarianMTModel, MarianTokenizer

_cache: dict = {}

# Map of "src-tgt" → Helsinki model name
MODEL_MAP = {
    "en-es": "Helsinki-NLP/opus-mt-en-es",
    "en-fr": "Helsinki-NLP/opus-mt-en-fr",
    "en-de": "Helsinki-NLP/opus-mt-en-de",
    "en-zh": "Helsinki-NLP/opus-mt-en-zh",
    "en-ja": "Helsinki-NLP/opus-mt-en-jap",
    "es-en": "Helsinki-NLP/opus-mt-es-en",
    "fr-en": "Helsinki-NLP/opus-mt-fr-en",
    "de-en": "Helsinki-NLP/opus-mt-de-en",
}


def _load(src: str, tgt: str):
    key = f"{src}-{tgt}"
    if key not in _cache:
        model_name = MODEL_MAP.get(key)
        if not model_name:
            raise ValueError(f"No model available for {key}. Supported: {list(MODEL_MAP.keys())}")
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        _cache[key] = (tokenizer, model)
    return _cache[key]


def translate(text: str, src_lang: str, tgt_lang: str) -> str:
    """Translate text from src_lang to tgt_lang. Returns empty string on empty input."""
    if not text.strip():
        return ""
    tokenizer, model = _load(src_lang, tgt_lang)
    inputs = tokenizer([text], return_tensors="pt", padding=True, truncation=True)
    translated = model.generate(**inputs)
    return tokenizer.decode(translated[0], skip_special_tokens=True)
