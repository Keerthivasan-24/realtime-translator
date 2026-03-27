"""
LLM-powered analysis: summaries and action item extraction.
Uses a local model via transformers or an API (OpenAI/Anthropic).
"""
import os
from typing import Dict, List

# Option 1: Use OpenAI API (recommended for quality)
USE_OPENAI = os.getenv("OPENAI_API_KEY") is not None

if USE_OPENAI:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
else:
    # Option 2: Local model (smaller, faster, but less accurate)
    from transformers import pipeline
    _summarizer = None
    
    def get_summarizer():
        global _summarizer
        if _summarizer is None:
            _summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
        return _summarizer


def generate_summary(transcript: List[Dict[str, str]]) -> str:
    """
    Generate a concise meeting summary from the full transcript.
    transcript = [{"speaker": "A", "text": "...", "translated": "..."}, ...]
    """
    if not transcript:
        return "No conversation recorded."
    
    # Build a readable text block
    text = "\n".join([
        f"{entry['speaker']}: {entry['text']} (translated: {entry['translated']})"
        for entry in transcript
    ])
    
    if USE_OPENAI:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a meeting assistant. Summarize the conversation concisely."},
                {"role": "user", "content": f"Summarize this conversation:\n\n{text}"}
            ],
            max_tokens=300,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    else:
        # Local summarization (works best on shorter texts)
        summarizer = get_summarizer()
        # BART has a 1024 token limit, truncate if needed
        truncated = text[:4000]
        result = summarizer(truncated, max_length=150, min_length=40, do_sample=False)
        return result[0]["summary_text"]


def extract_action_items(transcript: List[Dict[str, str]]) -> List[str]:
    """
    Extract action items, tasks, and commitments from the conversation.
    Returns a list of strings like ["John will send the report by Tuesday", ...]
    """
    if not transcript:
        return []
    
    text = "\n".join([
        f"{entry['speaker']}: {entry['text']} (translated: {entry['translated']})"
        for entry in transcript
    ])
    
    if USE_OPENAI:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a meeting assistant. Extract action items and tasks from the conversation. Return each as a bullet point."},
                {"role": "user", "content": f"Extract action items from this conversation:\n\n{text}"}
            ],
            max_tokens=300,
            temperature=0.3,
        )
        content = response.choices[0].message.content.strip()
        # Parse bullet points
        lines = [line.strip("- •*").strip() for line in content.split("\n") if line.strip()]
        return [line for line in lines if line]
    else:
        # Fallback: simple keyword matching (not as good)
        action_keywords = ["will", "should", "need to", "must", "going to", "promise", "commit"]
        items = []
        for entry in transcript:
            text_lower = entry["text"].lower()
            if any(kw in text_lower for kw in action_keywords):
                items.append(f"{entry['speaker']}: {entry['text']}")
        return items[:10]  # limit to 10
