"""
LLM analysis via OpenAI API — summary and action items.
"""
import os
import httpx
from typing import Dict, List

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


async def _chat(system: str, user: str, max_tokens: int = 400) -> str:
    if not OPENAI_API_KEY:
        return "Set OPENAI_API_KEY to enable AI summaries."
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}",
                     "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
                "max_tokens": max_tokens,
                "temperature": 0.3,
            },
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
        return "Summary unavailable."


async def generate_summary(transcript: List[Dict]) -> str:
    if not transcript:
        return "No conversation recorded."
    text = "\n".join(f"{e['speaker']}: {e['text']} → {e['translated']}" for e in transcript)
    return await _chat(
        "You are a meeting assistant. Summarize this conversation concisely in 3-5 sentences.",
        f"Summarize:\n\n{text[:4000]}"
    )


async def extract_action_items(transcript: List[Dict]) -> List[str]:
    if not transcript:
        return []
    text = "\n".join(f"{e['speaker']}: {e['text']}" for e in transcript)
    result = await _chat(
        "Extract action items and tasks from this conversation. Return each as a bullet point starting with '- '.",
        f"Extract action items:\n\n{text[:4000]}"
    )
    lines = [l.strip("- •*").strip() for l in result.split("\n") if l.strip()]
    return [l for l in lines if l and not l.startswith("Set OPENAI")]
