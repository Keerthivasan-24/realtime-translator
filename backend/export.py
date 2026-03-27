"""
Export utilities: PDF, TXT, Notion, Slack.
"""
import os
import json
import httpx
from io import BytesIO
from typing import Dict, List, Optional
from datetime import datetime

# PDF generation
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def build_txt(room_id: str, transcript: List[Dict], summary: str, action_items: List[str]) -> bytes:
    """Generate a plain-text transcript."""
    lines = [
        f"MEETING TRANSCRIPT",
        f"Room: {room_id}",
        f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        "=" * 60,
        "",
        "TRANSCRIPT",
        "-" * 40,
    ]
    for entry in transcript:
        ts = entry.get("timestamp", "")
        lines.append(f"[{ts}] {entry['speaker']}: {entry['text']}")
        if entry.get("translated") and entry["translated"] != entry["text"]:
            lines.append(f"         → {entry['translated']}")
    
    lines += ["", "SUMMARY", "-" * 40, summary, ""]
    
    if action_items:
        lines += ["ACTION ITEMS", "-" * 40]
        for item in action_items:
            lines.append(f"• {item}")
    
    return "\n".join(lines).encode("utf-8")


def build_pdf(room_id: str, transcript: List[Dict], summary: str, action_items: List[str]) -> bytes:
    """Generate a formatted PDF transcript."""
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab not installed. Run: pip install reportlab")
    
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                             topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    heading = ParagraphStyle("heading", parent=styles["Heading1"], fontSize=18, spaceAfter=6)
    subheading = ParagraphStyle("sub", parent=styles["Heading2"], fontSize=13, spaceAfter=4)
    body = styles["Normal"]
    translated_style = ParagraphStyle("trans", parent=body, textColor=colors.HexColor("#6366f1"),
                                       leftIndent=20, fontSize=10)
    
    story = [
        Paragraph("Meeting Transcript", heading),
        Paragraph(f"Room: {room_id} &nbsp;|&nbsp; {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", body),
        Spacer(1, 0.4*cm),
        Paragraph("Transcript", subheading),
    ]
    
    for entry in transcript:
        ts = entry.get("timestamp", "")
        story.append(Paragraph(f"<b>[{ts}] {entry['speaker']}:</b> {entry['text']}", body))
        if entry.get("translated") and entry["translated"] != entry["text"]:
            story.append(Paragraph(f"→ {entry['translated']}", translated_style))
        story.append(Spacer(1, 0.15*cm))
    
    story += [Spacer(1, 0.4*cm), Paragraph("Summary", subheading), Paragraph(summary, body)]
    
    if action_items:
        story += [Spacer(1, 0.4*cm), Paragraph("Action Items", subheading)]
        for item in action_items:
            story.append(Paragraph(f"• {item}", body))
    
    doc.build(story)
    return buf.getvalue()


async def export_to_notion(
    room_id: str,
    transcript: List[Dict],
    summary: str,
    action_items: List[str],
    notion_token: str,
    database_id: str,
) -> str:
    """Create a Notion page with the transcript. Returns the page URL."""
    headers = {
        "Authorization": f"Bearer {notion_token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }
    
    # Build Notion blocks
    blocks = [
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Summary"}}]}},
        {"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": summary}}]}},
    ]
    
    if action_items:
        blocks.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Action Items"}}]}})
        for item in action_items:
            blocks.append({"object": "block", "type": "bulleted_list_item",
                           "bulleted_list_item": {"rich_text": [{"text": {"content": item}}]}})
    
    blocks.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Full Transcript"}}]}})
    for entry in transcript[:50]:  # Notion block limit
        line = f"[{entry.get('timestamp','')}] {entry['speaker']}: {entry['text']}"
        if entry.get("translated") and entry["translated"] != entry["text"]:
            line += f" → {entry['translated']}"
        blocks.append({"object": "block", "type": "paragraph",
                        "paragraph": {"rich_text": [{"text": {"content": line[:2000]}}]}})
    
    payload = {
        "parent": {"database_id": database_id},
        "properties": {
            "Name": {"title": [{"text": {"content": f"Meeting: {room_id} — {datetime.utcnow().strftime('%Y-%m-%d')}"}}]},
        },
        "children": blocks,
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://api.notion.com/v1/pages", headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json().get("url", "")


async def export_to_slack(
    room_id: str,
    summary: str,
    action_items: List[str],
    webhook_url: str,
) -> None:
    """Post a summary to a Slack channel via Incoming Webhook."""
    action_text = "\n".join(f"• {item}" for item in action_items) if action_items else "_None detected_"
    
    payload = {
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": f"Meeting Summary — Room {room_id}"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Summary*\n{summary}"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*Action Items*\n{action_text}"}},
            {"type": "context", "elements": [{"type": "mrkdwn",
                "text": f"_{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_"}]},
        ]
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(webhook_url, json=payload)
        resp.raise_for_status()
